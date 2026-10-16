import { daysBetween, daysInMonth, lastMonths, monthKey } from "../dates";
import type { ActivityRecord, MonthKey, ScoringInput, Transaction, TransactionCategory } from "../types";

/** Inflow categories that count as earned income. Self-transfers never do. */
export const INCOME_CATEGORIES: readonly TransactionCategory[] = ["platform_payout", "client_payment", "transfer_p2p"];

export interface CircularPair {
  inflow: Transaction;
  outflow: Transaction;
}

/**
 * Circular money: the same counterparty sends and receives a similar amount
 * (±15%) within 7 days.
 */
export function findCircularPairs(transactions: readonly Transaction[]): CircularPair[] {
  const outs = transactions.filter((t) => t.direction === "out" && (t.category === "transfer_p2p" || t.category === "other"));
  const used = new Set<string>();
  const pairs: CircularPair[] = [];
  for (const inflow of transactions) {
    if (inflow.direction !== "in" || inflow.category !== "transfer_p2p") continue;
    const match = outs.find(
      (o) =>
        !used.has(o.id) &&
        o.counterparty === inflow.counterparty &&
        Math.abs(daysBetween(inflow.date, o.date)) <= 7 &&
        Math.abs(o.amount - inflow.amount) <= inflow.amount * 0.15,
    );
    if (match) {
      used.add(match.id);
      pairs.push({ inflow, outflow: match });
    }
  }
  return pairs;
}

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Same surname and same first initial counts as a match ("G. Beridze" = "Giorgi Beridze"). */
export function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x.length || !y.length) return false;
  return x[x.length - 1] === y[y.length - 1] && x[0][0] === y[0][0];
}

/** Bank sources whose account holder is not the KYC-verified borrower. */
export function foreignAccountIds(input: ScoringInput): string[] {
  return input.sources
    .filter((s) => s.type === "bank" && s.accountHolderName && !namesMatch(s.accountHolderName, input.borrower.name))
    .map((s) => s.id);
}

export interface MonthIncome {
  month: MonthKey;
  gross: number;
  verified: number;
  bySource: Record<string, number>;
  hours: number | null;
}

export interface IncomeAnalysis {
  /** Last 24 full months, oldest first. */
  months: MonthIncome[];
  /** Income transactions excluded from verified income, by reason. */
  excludedIds: Set<string>;
  circularPairs: CircularPair[];
  foreignAccounts: string[];
  firstIncomeMonth: MonthKey | null;
  /** Verified income per counterparty over the last 12 months. */
  byCounterparty12m: Map<string, number>;
}

export function incomeLabel(t: Transaction): string {
  if (t.category === "platform_payout") return t.counterparty;
  if (t.category === "client_payment") return "Direct clients";
  return "P2P transfers";
}

/**
 * Hours per month, normalised to the month's length (average weekly hours ×
 * days/7) so months with 4 vs 5 week-starts compare fairly.
 */
export function hoursByMonth(activity: readonly ActivityRecord[]): Map<MonthKey, number> {
  const acc = new Map<MonthKey, { total: number; weeks: number }>();
  for (const a of activity) {
    const k = monthKey(a.weekStart);
    const cur = acc.get(k) ?? { total: 0, weeks: 0 };
    acc.set(k, { total: cur.total + a.hoursOnline, weeks: cur.weeks + 1 });
  }
  const m = new Map<MonthKey, number>();
  for (const [k, v] of acc) m.set(k, (v.total / v.weeks) * (daysInMonth(k) / 7));
  return m;
}

export function analyzeIncome(input: ScoringInput): IncomeAnalysis {
  const circularPairs = findCircularPairs(input.transactions);
  const foreignAccounts = foreignAccountIds(input);
  const excludedIds = new Set<string>(circularPairs.map((p) => p.inflow.id));
  const keys = lastMonths(input.asOf, 24);
  const last12 = new Set(keys.slice(-12));
  const hours = hoursByMonth(input.activity);
  const hasActivity = input.activity.length > 0;
  const byMonth = new Map<MonthKey, MonthIncome>(
    keys.map((k) => [k, { month: k, gross: 0, verified: 0, bySource: {}, hours: hasActivity ? Math.round(hours.get(k) ?? 0) : null }]),
  );
  const byCounterparty12m = new Map<string, number>();
  let firstIncomeMonth: MonthKey | null = null;

  for (const t of input.transactions) {
    if (t.direction !== "in" || !INCOME_CATEGORIES.includes(t.category)) continue;
    const m = byMonth.get(monthKey(t.date));
    if (!m) continue;
    if (foreignAccounts.includes(t.sourceId)) excludedIds.add(t.id);
    m.gross += t.amount;
    if (excludedIds.has(t.id)) continue;
    m.verified += t.amount;
    const label = incomeLabel(t);
    m.bySource[label] = (m.bySource[label] ?? 0) + t.amount;
    if (!firstIncomeMonth || m.month < firstIncomeMonth) firstIncomeMonth = m.month;
    if (last12.has(m.month)) byCounterparty12m.set(t.counterparty, (byCounterparty12m.get(t.counterparty) ?? 0) + t.amount);
  }

  const months = keys.map((k) => {
    const m = byMonth.get(k) as MonthIncome;
    const bySource: Record<string, number> = {};
    for (const [label, v] of Object.entries(m.bySource)) bySource[label] = Math.round(v);
    return { ...m, gross: Math.round(m.gross), verified: Math.round(m.verified), bySource };
  });
  return { months, excludedIds, circularPairs, foreignAccounts, firstIncomeMonth, byCounterparty12m };
}
