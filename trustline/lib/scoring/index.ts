import { CURRENCY, DECISION_THRESHOLDS, SCORING_CONFIG } from "../config";
import { evaluateWorkCheck } from "../checker/evaluate";
import { WORK_CHECK_POINTS } from "../checker/profiles";
import type { Band, DataSufficiency, Decision, FraudFlag, ScoreReason, ScoreReport, ScoringInput, WorkCheckResult } from "../types";
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
  const workCheck = evaluateWorkCheck(input, features, features.grossMonthlyIncome);
  const reasons = [...card.reasons, workCheckReason(workCheck)];
  const fraudFlags = runFraudChecks(input, income, workCheck);

  const base = SCORING_CONFIG.baseScore;
  const uncappedScore = clampScore(base + card.coreImpact + workCheck.points);
  const notSharedPoints = workCheck.status === "not_supported" ? 0 : WORK_CHECK_POINTS.not_shared;
  const scoreWithoutActivity = clampScore(base + card.coreImpact + notSharedPoints);
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
    reasons,
    fraudFlags,
    earlyWarnings: earlyWarnings(input, features),
    workCheckPoints: workCheck.points,
    workCheck,
    decision: dataSufficiency === "insufficient" ? "review" : suggestDecision(score, fraudFlags),
    dataSufficiency,
    features,
    monthlyIncome,
    incomeSources: [...sources],
    improvementTips: improvementTips(input, features, reasons, workCheck),
    generatedAt,
  };
}

const STATUS_LABEL: Record<WorkCheckResult["status"], string> = {
  strong: "strong evidence",
  moderate: "moderate evidence",
  weak: "weak evidence",
  mismatch: "doesn't match income",
  not_shared: "not shared",
  not_supported: "not available",
};

function workCheckReason(w: WorkCheckResult): ScoreReason {
  const plain =
    w.status === "strong" ? `${w.summary} That adds ${w.points} points.` :
    w.status === "not_supported" ? w.summary :
    w.points > 0 ? `${w.summary} (+${w.points} points)` : `${w.summary} (${w.points} points)`;
  return {
    id: "work_check",
    label: `Work Checker: ${STATUS_LABEL[w.status]}`,
    plain,
    impact: w.points,
    direction: w.points > 0 ? "positive" : w.points < 0 ? "negative" : "neutral",
    detail: w.explainedIncome
      ? `${w.profession} · ${w.activeHoursPerWeek} h/week · explains ${CURRENCY.symbol}${w.explainedIncome.low.toLocaleString("en-US")}–${w.explainedIncome.high.toLocaleString("en-US")}/mo`
      : w.profession,
  };
}

function improvementTips(input: ScoringInput, f: ScoreReport["features"], reasons: ScoreReport["reasons"], w: WorkCheckResult): string[] {
  const tips: string[] = [];
  const r = (id: string) => reasons.find((x) => x.id === id);
  if (w.status === "not_shared") tips.push(`Connect your work apps in the Work Checker. Not sharing costs ${-WORK_CHECK_POINTS.not_shared} points; strong evidence adds +${WORK_CHECK_POINTS.strong}.`);
  else if (w.status === "weak" || w.status === "moderate") tips.push("Share more of your work (more files, repositories or lessons) so the Work Checker can confirm it — strong evidence is worth +50.");
  if (f.onTimeBillRate === null) tips.push("Connect your utility or mobile bills to prove you pay on time (up to +50 points).");
  else if (f.onTimeBillRate < 0.95) tips.push("Pay utility and phone bills before the due date — this factor is worth up to +50 points.");
  if (f.nearZeroBalanceCount > 0) tips.push("Try to keep a small buffer in your account; days near zero cost 5 points each.");
  if (f.gamblingShare > 0.01) tips.push("Reducing betting spend removes a penalty of up to 80 points.");
  if (f.topSourceShare > 0.8) tips.push("Adding a second income source (another platform or direct clients) lowers concentration risk.");
  if (f.tenureMonths < 12) tips.push("Your score improves automatically as your income history grows — check back in a couple of months.");
  if ((r("loans")?.impact ?? 0) < 0) tips.push("Bring existing loan repayments up to date; late instalments cost up to 50 points.");
  if (f.freeCashFlowRatio < 0.3) tips.push("Lowering fixed costs increases your free cash flow and the payment you can afford.");
  if (!input.sources.some((s) => s.type === "invoice_upload") && (input.borrower.workType === "developer" || input.borrower.workType === "designer"))
    tips.push("Upload invoices that match your client payments to strengthen your income evidence.");
  return tips.slice(0, 4);
}
