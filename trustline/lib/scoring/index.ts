import { DECISION_THRESHOLDS, SCORING_CONFIG } from "../config";
import type { Band, DataSufficiency, Decision, FraudFlag, ScoreReport, ScoringInput } from "../types";
import { applyScorecard, clampScore } from "./scorecard";
import { earlyWarnings, runFraudChecks } from "./fraud";
import { extractFeatures } from "./features";
import { analyzeIncome } from "./income";
import { round } from "./math";

export { analyzeIncome } from "./income";
export { extractFeatures } from "./features";
export { applyScorecard } from "./scorecard";
export { runFraudChecks, earlyWarnings, FRAUD_RULES } from "./fraud";

export function bandFor(score: number): Band {
  const b = SCORING_CONFIG.bands;
  if (score >= b.A) return "A";
  if (score >= b.B) return "B";
  if (score >= b.C) return "C";
  if (score >= b.D) return "D";
  return "E";
}

export interface DecisionThresholds {
  approveMinScore: number;
  declineBelowScore: number;
  declineHighFlags: number;
}

export function suggestDecision(score: number, flags: FraudFlag[], thresholds: DecisionThresholds = DECISION_THRESHOLDS): Decision {
  const high = flags.filter((f) => f.severity === "high").length;
  if (high >= thresholds.declineHighFlags || score < thresholds.declineBelowScore) return "decline";
  if (high > 0 || flags.some((f) => f.severity === "medium")) return "review";
  return score >= thresholds.approveMinScore ? "approve" : "review";
}

/**
 * Full pipeline: income analysis → features → scorecard → fraud checks → report.
 * Pure function of its input; the same input always yields the same report.
 */
export function computeScoreReport(input: ScoringInput, generatedAt = `${input.asOf}T00:00:00.000Z`): ScoreReport {
  const income = analyzeIncome(input);
  const features = extractFeatures(input, income);
  const card = applyScorecard(features, input.borrower.workType);
  const fraudFlags = runFraudChecks(input, income, features);

  const base = SCORING_CONFIG.baseScore;
  const uncappedScore = clampScore(base + card.coreImpact + card.activityBoost);
  const scoreWithoutActivity = clampScore(base + card.coreImpact);
  const hasHigh = fraudFlags.some((f) => f.severity === "high");
  const score = hasHigh ? Math.min(uncappedScore, SCORING_CONFIG.fraudCapScore) : uncappedScore;

  const dataSufficiency: DataSufficiency =
    features.tenureMonths === 0 ? "insufficient" : features.tenureMonths < 6 ? "limited" : "ok";

  const recommendedMaxPayment = Math.max(0, round((features.freeCashFlow * SCORING_CONFIG.paymentToFreeCashFlowRatio) / 10) * 10);

  const sources = new Set<string>();
  const monthlyIncome = income.months.slice(-12).map((m) => {
    Object.keys(m.bySource).forEach((k) => sources.add(k));
    return { month: m.month, bySource: m.bySource, gross: m.gross, verified: m.verified, hours: m.hours };
  });

  return {
    borrowerId: input.borrower.id,
    score,
    band: bandFor(score),
    baseScore: base,
    uncappedScore,
    bandCapped: hasHigh && uncappedScore > SCORING_CONFIG.fraudCapScore,
    scoreWithoutActivity,
    verifiedMonthlyIncome: features.verifiedMonthlyIncome,
    recommendedMaxPayment: hasHigh ? 0 : recommendedMaxPayment,
    reasons: card.reasons,
    fraudFlags,
    earlyWarnings: earlyWarnings(input, features),
    activityBoostApplied: card.activityBoost,
    decision: dataSufficiency === "insufficient" ? "review" : suggestDecision(score, fraudFlags),
    dataSufficiency,
    features,
    monthlyIncome,
    incomeSources: [...sources],
    improvementTips: improvementTips(input, features, card.reasons),
    generatedAt,
  };
}

function improvementTips(input: ScoringInput, f: ScoreReport["features"], reasons: ScoreReport["reasons"]): string[] {
  const tips: string[] = [];
  const r = (id: string) => reasons.find((x) => x.id === id);
  if (!f.hasActivityData) tips.push("Share your work-platform activity (hours, trips, contracts). It can only raise your score — up to +50 points.");
  if (f.onTimeBillRate === null) tips.push("Connect your utility or mobile bills to prove you pay on time (up to +50 points).");
  else if (f.onTimeBillRate < 0.95) tips.push("Pay utility and phone bills before the due date — this factor is worth up to +50 points.");
  if (f.nearZeroBalanceCount > 0) tips.push("Try to keep a small buffer in your account; days near zero cost 5 points each.");
  if (f.gamblingShare > 0.01) tips.push("Reducing betting spend removes a penalty of up to 80 points.");
  if (f.topSourceShare > 0.8) tips.push("Adding a second income source (another platform or direct clients) lowers concentration risk.");
  if (f.tenureMonths < 12) tips.push("Your score improves automatically as your income history grows — check back in a couple of months.");
  if ((r("loans")?.impact ?? 0) < 0) tips.push("Bring existing loan repayments up to date; late instalments cost up to 50 points.");
  if (f.freeCashFlowRatio < 0.3) tips.push("Lowering fixed costs increases your free cash flow and the payment you can afford.");
  if (!input.sources.some((s) => s.type === "invoice_upload") && input.borrower.workType === "it_freelance")
    tips.push("Upload invoices that match your client payments to strengthen your income evidence.");
  return tips.slice(0, 4);
}
