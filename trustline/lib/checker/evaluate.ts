import { CURRENCY } from "../config";
import { addDays } from "../dates";
import type { Features, ScoringInput, WorkCheckResult, WorkCheckStatus, WorkEvidenceLine } from "../types";
import { checkerFor, isWorkEvidenceType, WORK_CHECK_POINTS } from "./profiles";

const money = (x: number) => `${CURRENCY.symbol}${Math.round(x).toLocaleString("en-US")}`;
const WEEKS_PER_MONTH = 4.33;
export const ACTIVE_WEEK_MIN_HOURS = 10;
const RECENT_WEEKS = 12;

export const CHECKER_RULES = {
  strongConsistency: 0.8,
  moderateConsistency: 0.5,
  strongChecksShare: 0.75,
  moderateChecksShare: 0.5,
  /** Income above high × this is impossible for the observed work. */
  mismatchMultiple: 1.5,
  /** Strong evidence also needs income within high × this. */
  strongIncomeMultiple: 1.15,
  minWeeks: 4,
  /** Strong evidence needs at least two months of history. */
  strongMinWeeks: 8,
} as const;

/**
 * Work Checker: decides whether the work the borrower shared is "worth" the
 * income they claim. Pure function of the engine input + features.
 *
 *   1. Hours per week and consistency (share of weeks actually worked).
 *   2. Explained income = hours × 4.33 × the profession's realistic ₾/hour range.
 *   3. Profession-specific authenticity checks on the raw signals.
 *   4. Verdict → points (strong +50 … not shared −30 … mismatch −50).
 */
export function evaluateWorkCheck(input: ScoringInput, f: Features, claimedIncome: number): WorkCheckResult {
  const checker = checkerFor(input.borrower.workType);
  const income = f.verifiedMonthlyIncome;
  const base = { income, explainedIncome: null, activeHoursPerWeek: 0, consistency: 0, evidence: [] as WorkEvidenceLine[], sourcesUsed: [] as string[] };


  const workSources = input.sources.filter((s) => isWorkEvidenceType(s.type));
  const sourceIds = new Set(workSources.map((s) => s.id));
  const records = input.activity.filter((a) => sourceIds.has(a.sourceId));
  const result = (status: WorkCheckStatus, summary: string, extra: Partial<WorkCheckResult> = {}): WorkCheckResult => ({
    ...base,
    status,
    points: WORK_CHECK_POINTS[status],
    profession: checker.label,
    summary,
    sourcesUsed: workSources.map((s) => s.provider),
    ...extra,
  });

  if (!workSources.length || !records.length)
    return result(
      "not_shared",
      `${checker.sources.length ? `Connect ${checker.sources.slice(0, 2).map((s) => s.provider).join(" or ")}` : "Add the app you work in"} so we can confirm your work. Without it your score loses ${-WORK_CHECK_POINTS.not_shared} points.`,
    );

  // Weekly totals across all connected work tools.
  const weeks = new Map<string, { hours: number; signals: Record<string, number> }>();
  for (const r of records) {
    const w = weeks.get(r.weekStart) ?? { hours: 0, signals: {} };
    w.hours += r.hoursOnline;
    for (const [k, v] of Object.entries(r.signals)) w.signals[k] = k === "activeDays" ? Math.min(7, (w.signals[k] ?? 0) + v) : (w.signals[k] ?? 0) + v;
    weeks.set(r.weekStart, w);
  }
  const orderedEntries = [...weeks.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const ordered = orderedEntries.map(([, v]) => v);
  const last52 = ordered.slice(-52);
  const recent = ordered.slice(-RECENT_WEEKS);
  const active = (w: { hours: number }) => w.hours >= ACTIVE_WEEK_MIN_HOURS;

  // Seasonal earners (e.g. tutors) are judged on their working season only.
  const activeWeeks = last52.filter(active).length;
  const expectedWeeks = f.seasonal ? Math.max(activeWeeks, Math.round(last52.length * 0.75)) : last52.length;
  const consistency = expectedWeeks ? Math.min(1, activeWeeks / expectedWeeks) : 0;
  const recentKeys = orderedEntries.slice(-RECENT_WEEKS).map(([k]) => k);
  const basis = f.seasonal ? recent.filter(active) : recent;
  const basisWeeks = recentKeys.filter((_, i) => !f.seasonal || active(recent[i]));
  const hoursPerWeek = basis.length ? basis.reduce((a, w) => a + w.hours, 0) / basis.length : 0;
  const explained = { low: hoursPerWeek * WEEKS_PER_MONTH * checker.hourlyRange[0], high: hoursPerWeek * WEEKS_PER_MONTH * checker.hourlyRange[1] };

  const agg: Record<string, number> = {};
  for (const w of basis) for (const [k, v] of Object.entries(w.signals)) agg[k] = (agg[k] ?? 0) + v;
  const totalHours = basis.reduce((a, w) => a + w.hours, 0);

  const evidence: WorkEvidenceLine[] = [
    { label: "Weeks actually worked", value: `${Math.round(consistency * 100)}%${f.seasonal ? " of working season" : ""}`, target: `≥ ${CHECKER_RULES.strongConsistency * 100}%`, ok: consistency >= CHECKER_RULES.strongConsistency },
    { label: "Average working hours", value: `${hoursPerWeek.toFixed(0)} h/week`, target: `≥ ${ACTIVE_WEEK_MIN_HOURS} h/week`, ok: hoursPerWeek >= ACTIVE_WEEK_MIN_HOURS },
    {
      label: "Income this work can explain",
      value: `${money(explained.low)}–${money(explained.high)}/mo`,
      target: `covers ${money(income)} verified`,
      ok: income <= explained.high * CHECKER_RULES.strongIncomeMultiple,
    },
  ];
  for (const c of checker.checks) {
    const r = c.run(agg, { weeks: Math.max(1, basis.length), hours: Math.max(1, totalHours) });
    if (r) evidence.push({ label: c.label, value: r.value, target: c.target, ok: r.ok });
  }
  // Universal fraud check: earnings in uploaded/received work data must match what reached the bank.
  const earnings = basis.reduce((a, w) => a + (w.signals.earnings ?? 0), 0);
  if (earnings > 0 && basis.length) {
    const from = basisWeeks[0];
    const to = addDays(basisWeeks[basisWeeks.length - 1], 13);
    const keys = workSources.map((s) => s.provider.split(" ")[0].toLowerCase());
    const inflows = input.transactions.filter((t) => t.direction === "in" && t.date >= from && t.date <= to && (t.category === "platform_payout" || t.category === "client_payment"));
    const matching = inflows.filter((t) => keys.some((k) => t.counterparty.toLowerCase().includes(k)));
    const bank = (matching.length ? matching : inflows).reduce((a, t) => a + t.amount, 0);
    const ratio = bank > 0 ? earnings / bank : Infinity;
    evidence.push({
      label: "Earnings in work data vs bank deposits",
      value: bank > 0 ? `${Math.round(ratio * 100)}%` : "no deposits",
      target: "80–125% of what reached the bank",
      ok: ratio >= 0.8 && ratio <= 1.25,
    });
  }
  const qualityLines = evidence.slice(3);
  const checksShare = qualityLines.length ? qualityLines.filter((e) => e.ok).length / qualityLines.length : 1;
  const extra = { evidence, explainedIncome: { low: Math.round(explained.low), high: Math.round(explained.high) }, activeHoursPerWeek: Math.round(hoursPerWeek * 10) / 10, consistency: Math.round(consistency * 1000) / 1000 };

  const claimed = Math.max(claimedIncome, income);
  if (claimed > explained.high * CHECKER_RULES.mismatchMultiple)
    return result(
      "mismatch",
      `The work you shared (${hoursPerWeek.toFixed(0)} h/week) can explain at most about ${money(explained.high)} a month, but ${money(claimed)} a month came in. A lender will review this.`,
      extra,
    );

  // A forged or wildly inflated export is a mismatch, not just weak evidence.
  const crossCheck = evidence.find((e) => e.label === "Earnings in work data vs bank deposits");
  if (crossCheck && !crossCheck.ok && earnings > 0 && crossCheck.value !== "no deposits" && parseInt(crossCheck.value, 10) > 200)
    return result("mismatch", `Your work data reports ${money(earnings)} of earnings, far more than reached your bank in the same weeks. A lender will review this.`, extra);

  if (ordered.length < CHECKER_RULES.minWeeks) return result("weak", "We only have a few weeks of work data so far.", extra);

  const incomeOk = income <= explained.high * CHECKER_RULES.strongIncomeMultiple;
  if (consistency >= CHECKER_RULES.strongConsistency && checksShare >= CHECKER_RULES.strongChecksShare && incomeOk && hoursPerWeek >= ACTIVE_WEEK_MIN_HOURS && ordered.length >= CHECKER_RULES.strongMinWeeks)
    return result("strong", `Your ${checker.unit} on ${workSources.map((s) => s.provider).join(" + ")} clearly back up your income.`, extra);
  if (consistency >= CHECKER_RULES.moderateConsistency && checksShare >= CHECKER_RULES.moderateChecksShare)
    return result("moderate", "Your work data mostly backs up your income, but some checks didn't pass.", extra);
  return result("weak", "Your work data is patchy, so it doesn't fully back up your income.", extra);
}
