import { bandFor } from "../scoring";
import { clamp, mean, median, round, scale, stdDev, sum } from "../scoring/math";
import type { BetaFlag, BetaMonth, BetaReason, BetaScore, PaymentFact, WorkFact } from "./types";

/**
 * Designer-beta scorer. Uses only facts read from the source (wallet payments
 * from the blockchain, design work from Figma's servers), never uploads.
 * Pure: the same facts and date always give the same score.
 */

export const BETA_SCORING = {
  base: 500,
  /** Figma saves a checkpoint about every 30 minutes of editing. */
  minutesPerVersion: 30,
  maxMinutesPerFileDay: 480,
  /** Share of verified income treated as a safe monthly repayment until bank spending data is connected. */
  paymentShare: 0.3,
  fraudCap: 599,
} as const;

const monthKey = (iso: string) => iso.slice(0, 7);

function lastMonths(asOf: string, n: number): string[] {
  const d = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

/** Design hours per month: each saved version ≈ 30 min, capped per file per day. */
export function workMinutesByMonth(work: readonly WorkFact[]): Map<string, number> {
  const perFileDay = new Map<string, number>();
  for (const w of work) if (w.kind === "version") perFileDay.set(`${w.at.slice(0, 10)}|${w.item}`, (perFileDay.get(`${w.at.slice(0, 10)}|${w.item}`) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [k, n] of perFileDay) {
    const m = k.slice(0, 7);
    out.set(m, (out.get(m) ?? 0) + Math.min(BETA_SCORING.maxMinutesPerFileDay, n * BETA_SCORING.minutesPerVersion));
  }
  return out;
}

function activeWeeks(work: readonly WorkFact[], asOf: string, weeks: number): number {
  const end = new Date(asOf).getTime();
  const seen = new Set<number>();
  for (const w of work) {
    if (w.kind !== "version") continue;
    const age = (end - new Date(w.at).getTime()) / (7 * 864e5);
    if (age >= 0 && age < weeks) seen.add(Math.floor(age));
  }
  return seen.size;
}

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

export function computeBetaScore(input: { payments: readonly PaymentFact[]; work: readonly WorkFact[]; asOf: string }): BetaScore {
  const { asOf } = input;
  const income = input.payments.filter((p) => p.status === "income");
  const hasWork = input.work.some((w) => w.kind === "version");
  const months12 = lastMonths(asOf, 13).slice(0, 12); // last 12 complete months
  const recent6 = months12.slice(-6);

  const incomeBy = new Map<string, number>();
  for (const p of income) incomeBy.set(monthKey(p.at), (incomeBy.get(monthKey(p.at)) ?? 0) + p.amountUsd);
  const workBy = workMinutesByMonth(input.work);
  const months: BetaMonth[] = lastMonths(asOf, 12).map((m) => ({ month: m, income: round(incomeBy.get(m) ?? 0), workHours: round((workBy.get(m) ?? 0) / 60, 1) }));

  const series12 = months12.map((m) => incomeBy.get(m) ?? 0);
  const monthsWithIncome = series12.filter((x) => x > 0).length;
  const verifiedMonthlyIncome = round(median(recent6.map((m) => incomeBy.get(m) ?? 0)));
  const cv = mean(series12) > 0 ? stdDev(series12) / mean(series12) : 0;
  const since = `${months12[0]}-01`;
  const payers = new Map<string, number>();
  for (const p of income) if (p.at >= since) payers.set(p.payer, (payers.get(p.payer) ?? 0) + p.amountUsd);
  const totalPaid = sum([...payers.values()]);
  const topShare = totalPaid ? Math.max(...payers.values()) / totalPaid : 0;
  const firstDates = [...income.map((p) => p.at), ...input.work.map((w) => w.at)].sort();
  const historyMonths = firstDates.length ? Math.max(0, Math.round((new Date(asOf).getTime() - new Date(firstDates[0]).getTime()) / (30.44 * 864e5))) : 0;
  const weeksActive = activeWeeks(input.work, asOf, 12);
  const incomeMonths = months12.filter((m) => (incomeBy.get(m) ?? 0) > 0);
  const matched = incomeMonths.filter((m) => (workBy.get(m) ?? 0) > 0).length;
  const matchRatio = incomeMonths.length ? matched / incomeMonths.length : 0;

  const features = {
    verifiedMonthlyIncome,
    monthsWithIncome,
    incomeCV: round(cv, 2),
    distinctPayers: payers.size,
    topPayerShare: round(topShare, 2),
    historyMonths,
    activeWeeksLast12: weeksActive,
    workIncomeMatchRatio: round(matchRatio, 2),
    workHoursLast3Months: round(sum(months.slice(-3).map((m) => m.workHours)), 1),
  };

  const missing: string[] = [];
  if (!income.length) missing.push("Connect a wallet (or, soon, Gmail / Wise / bank) that has received client payments.");
  if (!hasWork) missing.push("Connect Figma so we can see the design work behind the income.");
  const generatedAt = new Date(asOf).toISOString();
  if (!income.length) {
    return { ready: false, missing, score: null, band: null, verifiedMonthlyIncome: 0, maxMonthlyPayment: 0, reasons: [], flags: [], months, features, generatedAt };
  }

  const reasons: BetaReason[] = [];
  const add = (id: string, label: string, impact: number, plain: string) => reasons.push({ id, label, impact: Math.round(impact), plain });

  add("income_level", "Verified monthly income", verifiedMonthlyIncome <= 0 ? -60 : scale(Math.log10(verifiedMonthlyIncome), Math.log10(300), Math.log10(3000), -10, 80), `Typical month over the last 6: ${usd(verifiedMonthlyIncome)}, counted only from payments we could prove.`);
  add("regularity", "Months with income", scale(monthsWithIncome, 3, 12, -40, 70), `You were paid in ${monthsWithIncome} of the last 12 months.`);
  add("stability", "Income stability", scale(cv, 0.2, 1.2, 60, -40), cv < 0.5 ? "Your monthly income is fairly steady." : "Your income changes a lot from month to month.");
  {
    let pts = payers.size >= 3 ? 25 : payers.size === 2 ? 10 : -10;
    if (payers.size > 1 && topShare > 0.85) pts -= 10;
    add("clients", "Client spread", pts, `${payers.size} different payer${payers.size === 1 ? "" : "s"}; the biggest pays ${Math.round(topShare * 100)}% of the total.`);
  }
  add("history", "Track record", scale(historyMonths, 3, 24, 0, 40), `${historyMonths} months of verifiable history.`);
  if (!hasWork) add("work", "Design work evidence", -30, "No work tool is connected, so we can't see the work behind the income.");
  else {
    add("work", "Design work evidence", scale(weeksActive, 2, 10, -10, 50), `Figma shows you designing in ${weeksActive} of the last 12 weeks.`);
    add("match", "Work matches income", scale(matchRatio, 0.3, 0.9, -20, 40), `${matched} of ${incomeMonths.length} paid months also show design work.`);
  }

  const flags: BetaFlag[] = [];
  const lastFull = series12[series12.length - 1];
  const prior = median(series12.slice(-7, -1));
  if (lastFull > 1000 && lastFull > 3 * Math.max(prior, 1)) {
    flags.push({ id: "income_spike", severity: "medium", title: "Sudden income jump", detail: `${usd(lastFull)} last month vs a usual ${usd(prior)}. Money appearing just before applying is a common trick.` });
    add("spike", "Sudden income jump", -40, "Last month's income is far above your usual level.");
  }
  if (hasWork && incomeMonths.length >= 3 && matchRatio < 0.3) {
    flags.push({ id: "income_without_work", severity: "high", title: "Income without design work", detail: `Only ${matched} of ${incomeMonths.length} paid months show any work in Figma.` });
  }

  let score = BETA_SCORING.base + sum(reasons.map((r) => r.impact));
  if (flags.some((f) => f.severity === "high")) score = Math.min(score, BETA_SCORING.fraudCap);
  score = Math.round(clamp(score, 300, 850));
  reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    ready: true,
    missing,
    score,
    band: bandFor(score),
    verifiedMonthlyIncome,
    maxMonthlyPayment: round(verifiedMonthlyIncome * BETA_SCORING.paymentShare),
    reasons,
    flags,
    months,
    features,
    generatedAt,
  };
}
