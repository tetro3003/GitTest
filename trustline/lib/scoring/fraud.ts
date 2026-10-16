import { CURRENCY } from "../config";
import { addDays, daysBetween, lastMonths, monthKey } from "../dates";
import type { EarlyWarning, Features, FraudFlag, ScoringInput, WorkCheckResult } from "../types";
import type { IncomeAnalysis } from "./income";
import { median, sum } from "./math";

const money = (x: number) => `${CURRENCY.symbol}${Math.round(x).toLocaleString("en-US")}`;

export const FRAUD_RULES = {
  circularMinPairs: 2,
  circularHighPairs: 3,
  spikeRatio: 1.8,
  spikeHighRatio: 3,
  invoiceGraceDays: 30,
  invoiceMatchWindowDays: 60,
  invoiceAmountTolerance: 0.02,
} as const;

/** Circular money: same counterparty sends and receives similar amounts within 7 days. */
export function checkCircularMoney(income: IncomeAnalysis): FraudFlag | null {
  const pairs = income.circularPairs;
  if (pairs.length < FRAUD_RULES.circularMinPairs) return null;
  const total = sum(pairs.map((p) => p.inflow.amount));
  const parties = [...new Set(pairs.map((p) => p.inflow.counterparty))];
  return {
    type: "circular_money",
    severity: pairs.length >= FRAUD_RULES.circularHighPairs ? "high" : "medium",
    title: "Circular money transfers",
    explanation: `${pairs.length} incoming transfers totalling ${money(total)} from ${parties.join(", ")} were sent back to the same people within 7 days. These are excluded from verified income.`,
    transactionIds: pairs.flatMap((p) => [p.inflow.id, p.outflow.id]),
  };
}

/** Pre-application spike: last 2 months income > 1.8× the prior 6-month median. */
export function checkIncomeSpike(input: ScoringInput, income: IncomeAnalysis): FraudFlag | null {
  const m = income.months;
  const recent = m.slice(-2).map((x) => x.gross);
  const prior = m.slice(-8, -2).map((x) => x.gross).filter((x) => x > 0);
  if (prior.length < 3) return null;
  const base = median(prior);
  const recentAvg = sum(recent) / 2;
  if (base <= 0 || recentAvg <= FRAUD_RULES.spikeRatio * base) return null;
  const ratio = recentAvg / base;
  const recentMonths = new Set(lastMonths(input.asOf, 2));
  return {
    type: "pre_application_spike",
    severity: ratio >= FRAUD_RULES.spikeHighRatio ? "high" : "medium",
    title: "Income spike before application",
    explanation: `Income in the last 2 months averaged ${money(recentAvg)}, ${ratio.toFixed(1)}× the prior 6-month median of ${money(base)}. Recent months are down-weighted in verified income.`,
    transactionIds: input.transactions
      .filter((t) => t.direction === "in" && recentMonths.has(monthKey(t.date)) && t.category !== "transfer_self" && t.amount > 300)
      .map((t) => t.id),
  };
}

/** Income vs work: raised when the Work Checker finds the work can't explain the income. */
export function checkIncomeActivityMismatch(input: ScoringInput, income: IncomeAnalysis, work: WorkCheckResult): FraudFlag | null {
  if (work.status !== "mismatch") return null;
  const monthSet = new Set(income.months.slice(-3).map((m) => m.month));
  return {
    type: "income_activity_mismatch",
    severity: "high",
    title: "Income doesn't match work activity",
    explanation: `Work Checker (${work.sourcesUsed.join(", ")}): ${work.activeHoursPerWeek} h/week can explain ${money(work.explainedIncome?.low ?? 0)}–${money(work.explainedIncome?.high ?? 0)} a month, far below the income claimed.`,
    transactionIds: input.transactions
      .filter((t) => t.direction === "in" && monthSet.has(monthKey(t.date)) && t.category !== "platform_payout" && t.category !== "transfer_self" && t.amount > 300)
      .map((t) => t.id),
  };
}

/** Invoices older than the grace period with no matching incoming payment. */
export function checkUnmatchedInvoices(input: ScoringInput): FraudFlag | null {
  const due = input.invoices.filter((i) => daysBetween(i.date, input.asOf) >= FRAUD_RULES.invoiceGraceDays);
  if (!due.length) return null;
  const ins = input.transactions.filter((t) => t.direction === "in");
  const unmatched = due.filter(
    (inv) =>
      !ins.some(
        (t) =>
          t.counterparty.toLowerCase() === inv.client.toLowerCase() &&
          t.date >= inv.date &&
          t.date <= addDays(inv.date, FRAUD_RULES.invoiceMatchWindowDays) &&
          Math.abs(t.amount - inv.amount) <= inv.amount * FRAUD_RULES.invoiceAmountTolerance,
      ),
  );
  if (unmatched.length < 2) return null;
  const share = sum(unmatched.map((i) => i.amount)) / sum(due.map((i) => i.amount));
  return {
    type: "unmatched_invoices",
    severity: share > 0.5 ? "high" : "medium",
    title: "Invoices without matching payments",
    explanation: `${unmatched.length} of ${due.length} uploaded invoices (${money(sum(unmatched.map((i) => i.amount)))}) have no matching incoming payment within ${FRAUD_RULES.invoiceMatchWindowDays} days.`,
    transactionIds: [],
    invoiceIds: unmatched.map((i) => i.id),
  };
}

/** Bank account holder name differs from the KYC-verified name. */
export function checkNameMismatch(input: ScoringInput, income: IncomeAnalysis): FraudFlag | null {
  if (!income.foreignAccounts.length) return null;
  const accounts = input.sources.filter((s) => income.foreignAccounts.includes(s.id));
  return {
    type: "name_mismatch",
    severity: "high",
    title: "Account holder name mismatch",
    explanation: `${accounts.map((a) => `${a.provider} account is held by "${a.accountHolderName}"`).join("; ")}, not the KYC-verified "${input.borrower.name}". Income on this account is excluded.`,
    transactionIds: input.transactions.filter((t) => income.foreignAccounts.includes(t.sourceId) && t.direction === "in").map((t) => t.id),
  };
}

export function runFraudChecks(input: ScoringInput, income: IncomeAnalysis, work: WorkCheckResult): FraudFlag[] {
  return [
    checkCircularMoney(income),
    checkIncomeSpike(input, income),
    checkIncomeActivityMismatch(input, income, work),
    checkUnmatchedInvoices(input),
    checkNameMismatch(input, income),
  ].filter((x): x is FraudFlag => x !== null);
}

/** Early warnings never change the score; they are surfaced for monitoring. */
export function earlyWarnings(input: ScoringInput, f: Features): EarlyWarning[] {
  const out: EarlyWarning[] = [];
  if (f.hasActivityData && f.activityChange4w <= -0.25) {
    out.push({
      type: "activity_decline",
      severity: f.activityChange4w <= -0.4 ? "high" : "medium",
      message: `Activity down ${Math.round(-f.activityChange4w * 100)}% over the last 4 weeks — early warning.`,
    });
  }
  const from30 = addDays(input.asOf, -30);
  const lowDays = new Set(input.transactions.filter((t) => t.date >= from30 && t.balanceAfter < 20).map((t) => t.date));
  if (lowDays.size >= 2) out.push({ type: "low_balance", severity: "low", message: `Balance near zero on ${lowDays.size} days in the last 30 days.` });
  const from60 = addDays(input.asOf, -60);
  const late = input.obligations.filter((o) => o.dueDate >= from60 && (o.paidDate === null || daysBetween(o.dueDate, o.paidDate) > 10));
  if (late.length) out.push({ type: "missed_bill", severity: late.some((o) => o.kind === "loan") ? "medium" : "low", message: `${late.length} bill/instalment(s) paid more than 10 days late in the last 60 days.` });
  return out;
}
