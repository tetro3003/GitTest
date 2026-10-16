import { CURRENCY, SCORING_CONFIG, SEGMENT_BENCHMARKS } from "../config";
import type { Features, ScoreReason, WorkType } from "../types";
import { clamp, round, scale } from "./math";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (x: number) => `${CURRENCY.symbol}${Math.round(x).toLocaleString("en-US")}`;

function reason(id: string, label: string, impact: number, detail: string, plain: string): ScoreReason {
  const pts = Math.round(impact);
  return { id, label, impact: pts, detail, plain, direction: pts > 0 ? "positive" : pts < 0 ? "negative" : "neutral" };
}

export interface ScorecardResult {
  reasons: ScoreReason[];
  /** Sum of all financial reasons (everything except the Work Checker). */
  coreImpact: number;
}

/**
 * Expert scorecard. Starts from the base score and adds or subtracts points
 * per factor. Each factor produces exactly one reason with its impact.
 */
export function applyScorecard(f: Features, workType: WorkType): ScorecardResult {
  const reasons: ScoreReason[] = [];
  // Confidence in stability-type factors grows with history (full at 12 months).
  const confidence = clamp(f.tenureMonths / 12, 0, 1);
  const confNote = confidence < 1 ? ` · scaled to ${pct(confidence)} for ${f.tenureMonths}-month history` : "";

  // 1. Income stability (CV)
  {
    const raw = f.incomeCV <= 0.25 ? scale(f.incomeCV, 0.08, 0.25, 90, 0) : scale(f.incomeCV, 0.25, 0.6, 0, -60);
    const pts = raw > 0 ? raw * confidence : raw;
    const plain =
      pts >= 50 ? "Your income arrives in a very steady pattern month to month." :
      pts > 0 ? "Your income is fairly steady, with some ups and downs." :
      f.seasonal ? "Your income swings a lot through the year, mostly because of seasonal months." :
      "Your income changes a lot from month to month.";
    reasons.push(reason("stability", "Income stability", pts, `CV ${f.incomeCV.toFixed(2)} around trend${confNote}`, plain));
  }

  // 2. Income level vs segment benchmark
  {
    const bench = SEGMENT_BENCHMARKS[workType].medianIncome;
    const ratio = bench > 0 ? f.verifiedMonthlyIncome / bench : 0;
    const pts = scale(ratio, 0.6, 2.0, 0, 60);
    reasons.push(
      reason(
        "income_level",
        "Verified income vs segment",
        pts,
        `${money(f.verifiedMonthlyIncome)} vs ${money(bench)} benchmark (${ratio.toFixed(2)}×)`,
        ratio >= 1
          ? `You earn more than a typical ${SEGMENT_BENCHMARKS[workType].label.toLowerCase()} (${money(bench)}/month).`
          : `Your verified income is below a typical ${SEGMENT_BENCHMARKS[workType].label.toLowerCase()} (${money(bench)}/month).`,
      ),
    );
  }

  // 3. Trend
  {
    const pts = f.tenureMonths < 4 ? 0 : f.trend === "growing" ? 30 : f.trend === "declining" ? -40 : 0;
    const per = `${f.trendSlope >= 0 ? "+" : ""}${(f.trendSlope * 100).toFixed(1)}%/month${f.seasonal ? " (year-over-year)" : ""}`;
    const plain =
      f.tenureMonths < 4 ? "Not enough history yet to see a trend." :
      f.trend === "growing" ? "Your income has been growing." :
      f.trend === "declining" ? "Your income has been going down recently." :
      "Your income has been holding steady.";
    reasons.push(reason("trend", `Income trend: ${f.trend}`, pts, per, plain));
  }

  // 4. Zero-income months
  {
    const pts = -15 * f.zeroIncomeMonths;
    reasons.push(
      reason(
        "zero_months",
        "Zero-income months (12m)",
        pts,
        `${f.zeroIncomeMonths} month(s)${f.seasonal ? " · recurring seasonal pattern" : ""}`,
        f.zeroIncomeMonths === 0
          ? "You had income every month."
          : f.seasonal
            ? `You had ${f.zeroIncomeMonths} month(s) with almost no income — the same months as last year, so lenders can plan around it.`
            : `You had ${f.zeroIncomeMonths} month(s) with almost no income.`,
      ),
    );
  }

  // 5. Diversification
  {
    const countPts = f.incomeSourceCount >= 3 ? 30 : f.incomeSourceCount === 2 ? 15 : 0;
    const concPts = f.topSourceShare > 0.8 ? -20 : 0;
    reasons.push(
      reason(
        "diversification",
        "Income diversification",
        countPts + concPts,
        `${f.incomeSourceCount} payer(s) ≥5% · top payer ${pct(f.topSourceShare)}`,
        concPts < 0
          ? `Most of your income (${pct(f.topSourceShare)}) comes from one payer.`
          : f.incomeSourceCount >= 3
            ? `You earn from ${f.incomeSourceCount} different payers, which lowers risk.`
            : "You earn from a couple of payers.",
      ),
    );
  }

  // 6. Free cash flow
  {
    const pts = scale(f.freeCashFlowRatio, 0.1, 0.6, 0, 70);
    reasons.push(
      reason(
        "free_cash_flow",
        "Free cash flow ratio",
        pts,
        `${money(f.freeCashFlow)}/month · ${pct(f.freeCashFlowRatio)} of income after essentials & debt`,
        f.freeCashFlowRatio >= 0.3
          ? `After rent, bills, food and existing loans you keep about ${money(f.freeCashFlow)} a month.`
          : `After essentials and existing loans little is left (${money(f.freeCashFlow)} a month).`,
      ),
    );
  }

  // 7. Near-zero balance events
  {
    const pts = Math.max(-40, -5 * f.nearZeroBalanceCount);
    reasons.push(
      reason(
        "low_balance",
        "Near-zero balance days",
        pts,
        `${f.nearZeroBalanceCount} day(s) under ${CURRENCY.symbol}20 · avg monthly low ${money(f.minBalanceAvg)}`,
        f.nearZeroBalanceCount === 0
          ? "Your account never ran close to empty."
          : `Your account dropped close to zero on ${f.nearZeroBalanceCount} day(s).`,
      ),
    );
  }

  // 8. Bills on time
  {
    const rate = f.onTimeBillRate;
    const raw = rate === null ? 0 : scale(rate, 0.6, 0.95, 0, 50);
    const pts = raw * confidence;
    reasons.push(
      reason(
        "bills",
        "On-time bill payments",
        pts,
        rate === null ? "No bill data shared" : `${pct(rate)} paid by due date${confNote}`,
        rate === null
          ? "Connect your utility or mobile bills to show you pay on time."
          : rate >= 0.95
            ? "You pay your bills on time."
            : `You paid ${pct(rate)} of bills on time.`,
      ),
    );
  }

  // 9. Existing loans
  {
    const r = f.loanRepaymentOnTime;
    const pts = r === null ? 0 : r >= 0.95 ? 30 : r < 0.8 ? -50 : scale(r, 0.8, 0.95, -50, 30);
    reasons.push(
      reason(
        "loans",
        "Existing loan repayments",
        pts,
        r === null ? "No existing loans found" : `${pct(r)} of instalments on time`,
        r === null ? "No existing loans found." : r >= 0.95 ? "You repay your existing loan on time." : "Some loan instalments were paid late.",
      ),
    );
  }

  // 10. Gambling
  {
    const pts = f.gamblingShare <= 0.01 ? 0 : scale(f.gamblingShare, 0.01, 0.1, 0, -80);
    reasons.push(
      reason(
        "gambling",
        "Gambling share of spending",
        pts,
        `${(f.gamblingShare * 100).toFixed(1)}% of spending`,
        pts < 0 ? `About ${pct(f.gamblingShare)} of your spending goes to betting.` : "No significant betting spend.",
      ),
    );
  }

  // 11. History length
  {
    const pts = f.tenureMonths < 6 ? -40 : f.tenureMonths < 12 ? -15 : f.tenureMonths >= 24 ? 10 : 0;
    reasons.push(
      reason(
        "tenure",
        "Income history length",
        pts,
        `${f.tenureMonths} month(s) of verified income`,
        f.tenureMonths < 6
          ? `We can only see ${f.tenureMonths} months of income so far — this improves automatically over time.`
          : `We can see ${f.tenureMonths} months of income history.`,
      ),
    );
  }

  const coreImpact = reasons.reduce((a, r) => a + r.impact, 0);

  return { reasons, coreImpact };
}

export function clampScore(x: number): number {
  return round(clamp(x, SCORING_CONFIG.minScore, SCORING_CONFIG.maxScore));
}
