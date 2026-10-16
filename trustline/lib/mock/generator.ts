import { addDays, addMonths, daysInMonth, lastMonths, monthKey, weekStart } from "../dates";
import type {
  ActivityRecord,
  DataSource,
  Invoice,
  ISODate,
  MonthKey,
  ObligationPayment,
  Transaction,
  TransactionCategory,
} from "../types";
import { createRng, type Rng } from "./rng";

/* ------------------------------------------------------------------ */
/* Spec types                                                          */
/* ------------------------------------------------------------------ */

export interface MonthCtx {
  month: MonthKey;
  /** 0-based index from the start of the history. */
  i: number;
  /** Number of months in the history. */
  n: number;
  rng: Rng;
}

export interface WeekCtx {
  weekStart: ISODate;
  month: MonthKey;
  /** 0-based week index from the start of activity. */
  w: number;
  /** Weeks remaining until the as-of date (0 = last week). */
  weeksAgo: number;
  rng: Rng;
}

export interface ActivitySpec {
  sourceId: string;
  /** Weeks of activity history ending at as-of. */
  weeks: number;
  hours: (ctx: WeekCtx) => number;
  tripsPerHour: number;
  activeContracts?: (ctx: WeekCtx) => number;
  distinctClients?: (ctx: WeekCtx) => number;
  rating?: number;
}

export type IncomeStreamSpec =
  | {
      kind: "platform";
      /** Counterparty name on the bank statement (matches the platform provider). */
      provider: string;
      /** Earnings per online hour, paid weekly for the previous week. */
      hourlyRate: number;
      bankSourceId: string;
    }
  | {
      kind: "clients";
      label: string;
      category: "client_payment" | "platform_payout";
      counterparties: string[];
      monthly: (ctx: MonthCtx) => number;
      paymentsPerMonth: [number, number];
      bankSourceId: string;
    };

export interface ExpenseSpec {
  rent: number;
  utilities: number;
  groceries: number;
  fuel: number;
  mobile: number;
  /** Share of a month's income kept as savings (rest goes to discretionary spend). */
  savingsRate: number;
  /** Share of spending that goes to betting sites. */
  gamblingShare: number;
  /** Probability that a given bill is paid on time. */
  billOnTimeRate: number;
  /** Monthly transfer to own savings account. */
  monthlySavingsTransfer?: number;
}

export interface LoanSpec {
  provider: string;
  monthly: number;
  /** Month indexes (from history start) on which the instalment is paid late. */
  lateMonths: number[];
  startMonthIndex: number;
}

export interface CircularSpec {
  counterparties: string[];
  /** Months (as months-ago, 1 = last full month) in which circular flows happen. */
  monthsAgo: number[];
  perMonth: number;
  amount: [number, number];
  bankSourceId: string;
}

export interface PersonaSpec {
  seed: number;
  /** Months of bank history. */
  historyMonths: number;
  /** Income only starts this many months before as-of (short history). */
  incomeMonths?: number;
  startBalance: number;
  sources: DataSource[];
  primaryBankId: string;
  utilitySourceId?: string;
  mobileSourceId?: string;
  invoiceSourceId?: string;
  streams: IncomeStreamSpec[];
  activity?: ActivitySpec;
  expenses: ExpenseSpec;
  loan?: LoanSpec;
  circular?: CircularSpec;
  /** Self transfers in from savings (months as month index of year, 0 = Jan). */
  savingsDrawdown?: { months: number[]; amount: number };
  /** Invoices: matched ones get a corresponding payment, unmatched do not. */
  invoices?: { matched: number; unmatched: number; clients: string[]; amount: [number, number] };
  /** Extra inflows on a secondary account (e.g. a third-party account). */
  secondaryInflows?: { bankSourceId: string; counterparty: string; perMonth: number; amount: [number, number]; monthsAgo: number[] };
}

export interface GeneratedData {
  transactions: Transaction[];
  activity: ActivityRecord[];
  obligations: ObligationPayment[];
  invoices: Invoice[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const round2 = (x: number) => Math.round(x * 100) / 100;

function dayIn(month: MonthKey, day: number): ISODate {
  const d = Math.min(Math.max(1, Math.round(day)), daysInMonth(month));
  return `${month}-${String(d).padStart(2, "0")}`;
}

function splitAmount(rng: Rng, total: number, parts: number): number[] {
  const w = Array.from({ length: parts }, () => rng.range(0.6, 1.4));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => round2((x / s) * total));
}

const GROCERS = ["FreshMart", "Daily Grocer", "Corner Market", "GreenBasket"];
const SHOPS = ["Café Aroma", "TechPoint", "City Pharmacy", "StyleHub", "Cinema One", "HomeGoods"];
const FUEL = ["FuelOne", "PetroLine"];

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

interface Draft {
  date: ISODate;
  amount: number;
  direction: "in" | "out";
  counterparty: string;
  category: TransactionCategory;
  sourceId: string;
  /** Discretionary outflows can be trimmed if the balance would go negative. */
  flexible?: boolean;
}

export function generatePersonaData(id: string, spec: PersonaSpec, asOf: ISODate): GeneratedData {
  const rng = createRng(spec.seed);
  const months = lastMonths(asOf, spec.historyMonths);
  const incomeStart = spec.incomeMonths ? spec.historyMonths - spec.incomeMonths : 0;
  const drafts: Draft[] = [];
  const obligations: ObligationPayment[] = [];
  const invoices: Invoice[] = [];

  /* ---------- Activity (weekly) ---------- */
  const activity: ActivityRecord[] = [];
  const hoursByWeek = new Map<ISODate, number>();
  if (spec.activity) {
    const a = spec.activity;
    const lastWeek = weekStart(addDays(asOf, -7));
    for (let k = a.weeks - 1; k >= 0; k--) {
      const ws = addDays(lastWeek, -7 * k);
      const ctx: WeekCtx = { weekStart: ws, month: monthKey(ws), w: a.weeks - 1 - k, weeksAgo: k, rng };
      const hours = Math.max(0, Math.round(a.hours(ctx) * 10) / 10);
      hoursByWeek.set(ws, hours);
      activity.push({
        weekStart: ws,
        sourceId: a.sourceId,
        hoursOnline: hours,
        tripsOrOrders: Math.round(hours * a.tripsPerHour * rng.range(0.9, 1.1)),
        activeContracts: a.activeContracts ? Math.max(0, Math.round(a.activeContracts(ctx))) : 0,
        rating: a.rating && hours > 0 ? Math.round(Math.min(5, a.rating + rng.normal(0, 0.04)) * 100) / 100 : null,
        distinctClients: a.distinctClients
          ? Math.max(0, Math.round(a.distinctClients(ctx)))
          : Math.round(hours * a.tripsPerHour * 0.9),
      });
    }
  }

  /* ---------- Income ---------- */
  for (const s of spec.streams) {
    if (s.kind === "platform") {
      // Weekly payout on Monday (or next day) for the previous week's hours.
      for (const [ws, hours] of hoursByWeek) {
        if (hours <= 0) continue;
        const payDate = addDays(ws, 7 + rng.int(0, 1));
        if (payDate >= asOf || payDate < `${months[0]}-01`) continue;
        drafts.push({
          date: payDate,
          amount: round2(hours * s.hourlyRate * rng.range(0.92, 1.08)),
          direction: "in",
          counterparty: s.provider,
          category: "platform_payout",
          sourceId: s.bankSourceId,
        });
      }
    } else {
      months.forEach((month, i) => {
        if (i < incomeStart) return;
        const total = s.monthly({ month, i, n: months.length, rng });
        if (total <= 5) return;
        const parts = rng.int(s.paymentsPerMonth[0], s.paymentsPerMonth[1]);
        splitAmount(rng, total, parts).forEach((amount) => {
          drafts.push({
            date: dayIn(month, rng.int(1, 28)),
            amount,
            direction: "in",
            counterparty: rng.pick(s.counterparties),
            category: s.category,
            sourceId: s.bankSourceId,
          });
        });
      });
    }
  }

  /* ---------- Expected income per month (drives discretionary spending) ---------- */
  const incomeByMonth = new Map<MonthKey, number>();
  for (const d of drafts) {
    if (d.direction === "in") incomeByMonth.set(monthKey(d.date), (incomeByMonth.get(monthKey(d.date)) ?? 0) + d.amount);
  }

  /* ---------- Expenses ---------- */
  const e = spec.expenses;
  const bank = spec.primaryBankId;
  months.forEach((month, i) => {
    const income = incomeByMonth.get(month) ?? 0;
    const winter = [0, 1, 11].includes(Number(month.slice(5)) - 1);

    if (e.rent > 0)
      drafts.push({ date: dayIn(month, rng.int(1, 4)), amount: e.rent, direction: "out", counterparty: "Landlord (rent)", category: "rent", sourceId: bank });

    // Bills: utility + mobile, with due date and actual paid date.
    const bills: { kind: "utility" | "mobile"; provider: string; amount: number; sourceId?: string }[] = [
      { kind: "utility", provider: "CityPower & Water", amount: round2(e.utilities * (winter ? 1.45 : 1) * rng.range(0.85, 1.15)), sourceId: spec.utilitySourceId },
      { kind: "mobile", provider: "MobiCell", amount: e.mobile, sourceId: spec.mobileSourceId },
    ];
    for (const b of bills) {
      if (b.amount <= 0) continue;
      const due = dayIn(month, 20);
      const onTime = rng.chance(e.billOnTimeRate);
      const paid = onTime ? addDays(due, -rng.int(0, 6)) : addDays(due, rng.int(6, 24));
      drafts.push({ date: paid, amount: b.amount, direction: "out", counterparty: b.provider, category: "utilities", sourceId: bank });
      if (b.sourceId)
        obligations.push({ id: `${id}-ob-${month}-${b.kind}`, sourceId: b.sourceId, kind: b.kind, provider: b.provider, amount: b.amount, dueDate: due, paidDate: paid < asOf ? paid : null });
    }

    // Groceries.
    const gCount = rng.int(7, 11);
    splitAmount(rng, e.groceries * rng.range(0.9, 1.1), gCount).forEach((amount) =>
      drafts.push({ date: dayIn(month, rng.int(1, 28)), amount, direction: "out", counterparty: rng.pick(GROCERS), category: "groceries", sourceId: bank, flexible: true }),
    );

    // Fuel scales with how much the person drove.
    if (e.fuel > 0) {
      const monthHours = [...hoursByWeek].filter(([ws]) => monthKey(ws) === month).reduce((a, [, h]) => a + h, 0);
      const fuelTotal = spec.activity ? (monthHours / 180) * e.fuel : e.fuel;
      if (fuelTotal > 10)
        splitAmount(rng, fuelTotal, 4).forEach((amount, k) =>
          drafts.push({ date: dayIn(month, 3 + k * 7), amount, direction: "out", counterparty: rng.pick(FUEL), category: "fuel", sourceId: bank }),
        );
    }

    // Loan.
    if (spec.loan && i >= spec.loan.startMonthIndex) {
      const due = dayIn(month, 15);
      const late = spec.loan.lateMonths.includes(i);
      const paid = late ? addDays(due, rng.int(12, 35)) : addDays(due, -rng.int(0, 3));
      drafts.push({ date: paid, amount: spec.loan.monthly, direction: "out", counterparty: spec.loan.provider, category: "loan_repayment", sourceId: bank });
      obligations.push({ id: `${id}-loan-${month}`, sourceId: bank, kind: "loan", provider: spec.loan.provider, amount: spec.loan.monthly, dueDate: due, paidDate: paid < asOf ? paid : null });
    }

    // Savings transfer.
    if (e.monthlySavingsTransfer && income > e.monthlySavingsTransfer * 3)
      drafts.push({ date: dayIn(month, 26), amount: e.monthlySavingsTransfer, direction: "out", counterparty: "Own savings account", category: "transfer_self", sourceId: bank });

    // Discretionary spend.
    const fixed = e.rent + e.utilities + e.mobile + e.groceries + e.fuel + (spec.loan?.monthly ?? 0) + (e.monthlySavingsTransfer ?? 0);
    const discretionary = Math.max(60, income * (1 - e.savingsRate) - fixed) * rng.range(0.85, 1.15);
    const gamble = discretionary * e.gamblingShare * 3;
    const shopping = Math.max(30, discretionary - gamble);
    splitAmount(rng, shopping, rng.int(5, 10)).forEach((amount) =>
      drafts.push({ date: dayIn(month, rng.int(1, 28)), amount, direction: "out", counterparty: rng.pick(SHOPS), category: "other", sourceId: bank, flexible: true }),
    );
    if (gamble > 5)
      splitAmount(rng, gamble, rng.int(3, 6)).forEach((amount) =>
        drafts.push({ date: dayIn(month, rng.int(1, 28)), amount, direction: "out", counterparty: "BetZone", category: "gambling", sourceId: bank, flexible: true }),
      );

    // Savings drawdown (e.g. tutor in summer).
    if (spec.savingsDrawdown?.months.includes(Number(month.slice(5)) - 1))
      drafts.push({ date: dayIn(month, 2), amount: spec.savingsDrawdown.amount, direction: "in", counterparty: "Own savings account", category: "transfer_self", sourceId: bank });

    // A couple of genuine P2P transfers from family now and then.
    if (rng.chance(0.15))
      drafts.push({ date: dayIn(month, rng.int(1, 28)), amount: round2(rng.range(40, 150)), direction: "in", counterparty: "Family transfer", category: "transfer_p2p", sourceId: bank });
  });

  /* ---------- Circular money (fraud persona) ---------- */
  if (spec.circular) {
    const c = spec.circular;
    for (const ago of c.monthsAgo) {
      const month = addMonths(monthKey(asOf), -ago);
      for (let k = 0; k < c.perMonth; k++) {
        const cp = c.counterparties[k % c.counterparties.length];
        const amount = round2(rng.range(c.amount[0], c.amount[1]));
        const d = dayIn(month, 2 + k * Math.floor(24 / c.perMonth));
        drafts.push({ date: d, amount, direction: "in", counterparty: cp, category: "transfer_p2p", sourceId: c.bankSourceId });
        drafts.push({ date: addDays(d, rng.int(1, 5)), amount: round2(amount * rng.range(0.94, 1.0)), direction: "out", counterparty: cp, category: "transfer_p2p", sourceId: c.bankSourceId });
      }
    }
  }

  /* ---------- Secondary-account inflows ---------- */
  if (spec.secondaryInflows) {
    const s = spec.secondaryInflows;
    for (const ago of s.monthsAgo) {
      const month = addMonths(monthKey(asOf), -ago);
      for (let k = 0; k < s.perMonth; k++)
        drafts.push({ date: dayIn(month, rng.int(1, 28)), amount: round2(rng.range(s.amount[0], s.amount[1])), direction: "in", counterparty: s.counterparty, category: "client_payment", sourceId: s.bankSourceId });
    }
  }

  /* ---------- Invoices ---------- */
  if (spec.invoices && spec.invoiceSourceId) {
    const inv = spec.invoices;
    const window = new Set([2, 3, 4, 5].map((k) => addMonths(monthKey(asOf), -k)));
    // Matched invoices document real client payments that already exist.
    const payments = drafts.filter(
      (d) => d.direction === "in" && d.category === "client_payment" && inv.clients.includes(d.counterparty) && window.has(monthKey(d.date)),
    );
    let k = 0;
    for (const p of payments.slice(0, inv.matched)) {
      invoices.push({ id: `${id}-inv-${++k}`, sourceId: spec.invoiceSourceId, date: addDays(p.date, -rng.int(5, 25)), client: p.counterparty, amount: p.amount });
    }
    // Unmatched invoices have no payment behind them.
    for (let u = 0; u < inv.unmatched; u++) {
      const month = addMonths(monthKey(asOf), -(2 + (u % 3)));
      invoices.push({
        id: `${id}-inv-${++k}`,
        sourceId: spec.invoiceSourceId,
        date: dayIn(month, rng.int(1, 20)),
        client: rng.pick(inv.clients),
        amount: Math.round(rng.range(inv.amount[0], inv.amount[1])),
      });
    }
  }

  /* ---------- Balance pass ---------- */
  const firstDay = `${months[0]}-01`;
  const ordered = drafts
    .filter((d) => d.date >= firstDay && d.date < asOf)
    .sort((a, b) => (a.date === b.date ? (a.direction === "out" ? -1 : 1) : a.date < b.date ? -1 : 1));

  const balances = new Map<string, number>();
  const transactions: Transaction[] = [];
  let seq = 0;
  for (const d of ordered) {
    let bal = balances.get(d.sourceId) ?? (d.sourceId === bank ? spec.startBalance : 0);
    let amount = d.amount;
    if (d.direction === "out" && d.flexible && bal - amount < 0) {
      amount = round2(Math.max(0, bal - rng.range(2, 25)));
      if (amount < 3) continue;
    }
    bal = round2(bal + (d.direction === "in" ? amount : -amount));
    balances.set(d.sourceId, bal);
    transactions.push({
      id: `${id}-tx-${String(++seq).padStart(5, "0")}`,
      date: d.date,
      amount,
      direction: d.direction,
      counterparty: d.counterparty,
      category: d.category,
      sourceId: d.sourceId,
      balanceAfter: bal,
    });
  }

  return { transactions, activity, obligations: obligations.filter((o) => o.dueDate < asOf), invoices };
}
