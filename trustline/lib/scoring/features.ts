import { SCORING_CONFIG } from "../config";
import { addDays, lastMonths, monthKey } from "../dates";
import type { Features, ScoringInput, Trend } from "../types";
import type { IncomeAnalysis } from "./income";
import { weeklyTotals } from "./activity";
import { clamp, linearFit, mean, median, round, stdDev, sum, weightedMedian } from "./math";

const ESSENTIAL = new Set(["rent", "utilities", "groceries", "fuel"]);

export const LOW_BALANCE_THRESHOLD = 20;
export const ACTIVE_WEEK_MIN_HOURS = 10;

function classifyTrend(relSlope: number): Trend {
  if (relSlope > 0.012) return "growing";
  if (relSlope < -0.015) return "declining";
  return "flat";
}

/**
 * Feature extraction. Everything the scorecard needs, computed only from the
 * data the borrower chose to share.
 */
export function extractFeatures(input: ScoringInput, income: IncomeAnalysis): Features {
  const { asOf } = input;
  const all = income.months;
  // Only months since income started count (a short history is not "zero income").
  const started = income.firstIncomeMonth ? all.filter((m) => m.month >= (income.firstIncomeMonth as string)) : [];
  const last12 = started.slice(-12);
  const last6 = started.slice(-6);
  const last3 = started.slice(-3);
  const v12 = last12.map((m) => m.verified);
  const v6 = last6.map((m) => m.verified);
  const recentWeights = (n: number) => Array.from({ length: n }, (_, i) => (i >= n - 2 ? SCORING_CONFIG.recentMonthWeight : 1));

  const weightedAvg = (vals: number[]) => {
    const w = recentWeights(vals.length);
    return vals.length ? sum(vals.map((v, i) => v * w[i])) / sum(w) : 0;
  };

  const avgIncome3m = weightedAvg(last3.map((m) => m.verified));
  const avgIncome6m = weightedAvg(v6);
  const avgIncome12m = weightedAvg(v12);
  const medianIncome6m = weightedMedian(v6, recentWeights(v6.length));
  const median12 = median(v12);

  // Seasonality: low months that repeat in the same calendar months a year earlier.
  const lowThreshold = (vals: number[]) => Math.max(50, 0.4 * median(vals));
  let seasonal = false;
  if (started.length >= 20) {
    const prev12 = started.slice(-24, -12);
    const lowNow = last12.filter((m) => m.verified < lowThreshold(v12)).map((m) => m.month.slice(5));
    const lowPrev = new Set(prev12.filter((m) => m.verified < lowThreshold(prev12.map((p) => p.verified))).map((m) => m.month.slice(5)));
    const overlap = lowNow.filter((m) => lowPrev.has(m)).length;
    seasonal = lowNow.length >= 2 && overlap / lowNow.length >= 0.75;
  }

  // Stability: residual variation around the trend line, so steady growth is not "instability".
  const fit = linearFit(v12, recentWeights(v12.length));
  const residuals = v12.map((v, i) => v - (fit.intercept + fit.slope * i));
  const m12 = mean(v12);
  const incomeCV = m12 > 0 && v12.length >= 2 ? stdDev(residuals) / m12 : 1;

  // Trend: year-over-year for seasonal earners, otherwise the weighted slope.
  let trendSlope = m12 > 0 && v12.length >= 4 ? fit.slope / m12 : 0;
  if (seasonal) {
    const prev = sum(started.slice(-24, -12).map((m) => m.verified));
    const cur = sum(v12);
    trendSlope = prev > 0 ? (cur / prev - 1) / 12 : 0;
  }

  const zeroIncomeMonths = last12.filter((m) => m.verified < Math.max(50, 0.1 * median12)).length;

  // Diversification across payers with at least 5% share of 12m verified income.
  const total12 = sum([...income.byCounterparty12m.values()]);
  const shares = [...income.byCounterparty12m.values()].map((v) => (total12 > 0 ? v / total12 : 0));
  const incomeSourceCount = shares.filter((s) => s >= 0.05).length;
  const topSourceShare = shares.length ? Math.max(...shares) : 0;

  // Verified income: conservative 6-month weighted median; seasonal earners use the 12-month average.
  const verifiedMonthlyIncome = seasonal ? avgIncome12m : medianIncome6m;
  const grossMonthlyIncome = median(started.slice(-6).map((m) => m.gross));

  // Spending (last 6 months, own accounts only).
  const from6 = `${lastMonths(asOf, 6)[0]}-01`;
  const from12 = `${lastMonths(asOf, 12)[0]}-01`;
  const ownTx = input.transactions.filter((t) => !income.foreignAccounts.includes(t.sourceId));
  const outs6 = ownTx.filter((t) => t.direction === "out" && t.date >= from6 && !income.excludedIds.has(t.id));
  const monthsSpan = Math.max(1, Math.min(6, started.length || 1));
  const essentialSpend = sum(outs6.filter((t) => ESSENTIAL.has(t.category)).map((t) => t.amount)) / monthsSpan;
  const existingDebtPayments = sum(outs6.filter((t) => t.category === "loan_repayment").map((t) => t.amount)) / monthsSpan;
  const circularOutIds = new Set(income.circularPairs.map((p) => p.outflow.id));
  const spendOuts = outs6.filter((t) => t.category !== "transfer_self" && !circularOutIds.has(t.id));
  const totalSpend = sum(spendOuts.map((t) => t.amount));
  const gamblingShare = totalSpend > 0 ? sum(spendOuts.filter((t) => t.category === "gambling").map((t) => t.amount)) / totalSpend : 0;
  const freeCashFlow = verifiedMonthlyIncome - essentialSpend - existingDebtPayments;
  const freeCashFlowRatio = verifiedMonthlyIncome > 0 ? freeCashFlow / verifiedMonthlyIncome : 0;

  // Balances on the primary (own) bank accounts, last 12 months.
  const bal12 = ownTx.filter((t) => t.date >= from12);
  const minByMonth = new Map<string, number>();
  const lowDays = new Set<string>();
  for (const t of bal12) {
    const k = monthKey(t.date);
    minByMonth.set(k, Math.min(minByMonth.get(k) ?? Infinity, t.balanceAfter));
    if (t.balanceAfter < LOW_BALANCE_THRESHOLD) lowDays.add(t.date);
  }
  const minBalanceAvg = minByMonth.size ? mean([...minByMonth.values()]) : 0;

  // Bills and loans (last 12 months).
  const ob12 = input.obligations.filter((o) => o.dueDate >= from12);
  const onTime = (o: (typeof ob12)[number]) => o.paidDate !== null && o.paidDate <= addDays(o.dueDate, 2);
  const bills = ob12.filter((o) => o.kind !== "loan");
  const loans = ob12.filter((o) => o.kind === "loan");
  const onTimeBillRate = bills.length ? bills.filter(onTime).length / bills.length : null;
  const loanRepaymentOnTime = loans.length ? loans.filter((o) => o.paidDate !== null && o.paidDate <= addDays(o.dueDate, 5)).length / loans.length : null;

  // Work activity (only present when the borrower opted in).
  const acts = weeklyTotals(input.activity);
  const hasActivityData = acts.length >= 8;
  const last52 = acts.slice(-52);
  const activeWeeksLast52 = last52.filter((a) => a.hours >= ACTIVE_WEEK_MIN_HOURS).length;
  const activityConsistency = last52.length ? activeWeeksLast52 / last52.length : 0;
  const hrs = acts.map((a) => a.hours);
  const avgH = (xs: number[]) => (xs.length ? mean(xs) : 0);
  let activityTrend: Trend = "flat";
  if (hasActivityData) {
    const recent = avgH(hrs.slice(-12));
    const base = hrs.length >= 64 ? avgH(hrs.slice(-64, -52)) : avgH(hrs.slice(-24, -12).length ? hrs.slice(-24, -12) : hrs.slice(0, -12));
    if (base > 0) {
      const ch = recent / base - 1;
      activityTrend = ch > 0.08 ? "growing" : ch < -0.15 ? "declining" : "flat";
    }
  }
  const last4 = avgH(hrs.slice(-4));
  const prev4 = avgH(hrs.slice(-8, -4));
  const activityChange4w = hasActivityData && prev4 > 0 ? last4 / prev4 - 1 : 0;
  const ratings = acts.map((a) => a.rating).filter((r): r is number => r !== null);

  return {
    avgIncome3m: round(avgIncome3m),
    avgIncome6m: round(avgIncome6m),
    avgIncome12m: round(avgIncome12m),
    medianIncome6m: round(medianIncome6m),
    incomeCV: round(clamp(incomeCV, 0, 3), 3),
    trendSlope: round(trendSlope, 4),
    trend: v12.length >= 4 ? classifyTrend(trendSlope) : "flat",
    zeroIncomeMonths,
    incomeSourceCount,
    topSourceShare: round(topSourceShare, 3),
    seasonal,
    essentialSpend: round(essentialSpend),
    existingDebtPayments: round(existingDebtPayments),
    freeCashFlow: round(freeCashFlow),
    freeCashFlowRatio: round(freeCashFlowRatio, 3),
    minBalanceAvg: round(minBalanceAvg),
    nearZeroBalanceCount: lowDays.size,
    onTimeBillRate: onTimeBillRate === null ? null : round(onTimeBillRate, 3),
    loanRepaymentOnTime: loanRepaymentOnTime === null ? null : round(loanRepaymentOnTime, 3),
    gamblingShare: round(gamblingShare, 4),
    hasActivityData,
    activeWeeksLast52,
    activityConsistency: round(activityConsistency, 3),
    activityTrend,
    activityChange4w: round(activityChange4w, 3),
    avgRating: ratings.length ? round(mean(ratings), 2) : null,
    tenureMonths: started.length,
    verifiedMonthlyIncome: round(verifiedMonthlyIncome),
    grossMonthlyIncome: round(grossMonthlyIncome),
  };
}
