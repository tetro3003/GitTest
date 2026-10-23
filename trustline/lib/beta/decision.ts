import type { BetaScore, Recommendation } from "./types";

/**
 * What the system SUGGESTS to the lender's officer. It never decides: the
 * officer approves, declines or asks for more, and that human decision is logged.
 */
export function recommend(s: BetaScore): Recommendation {
  if (!s.ready || s.score == null) return { action: "review", maxMonthlyPayment: 0, why: ["Not enough verified data for a score yet.", ...s.missing] };
  const why: string[] = [];
  const high = s.flags.filter((f) => f.severity === "high");
  const medium = s.flags.filter((f) => f.severity === "medium");
  for (const f of [...high, ...medium]) why.push(`${f.title}: ${f.detail}`);
  const strongest = [...s.reasons].sort((a, b) => b.impact - a.impact).slice(0, 2).filter((r) => r.impact > 0);
  const weakest = [...s.reasons].sort((a, b) => a.impact - b.impact).slice(0, 1).filter((r) => r.impact < 0);
  for (const r of strongest) why.push(`${r.label} (+${r.impact}): ${r.plain}`);
  for (const r of weakest) why.push(`${r.label} (${r.impact}): ${r.plain}`);

  if (high.length || medium.length) return { action: "review", maxMonthlyPayment: s.maxMonthlyPayment, why };
  if (s.band === "A" || s.band === "B") return { action: "approve", maxMonthlyPayment: s.maxMonthlyPayment, why };
  if (s.band === "C") return { action: "review", maxMonthlyPayment: s.maxMonthlyPayment, why };
  return { action: "decline", maxMonthlyPayment: 0, why };
}

export const RECOMMENDATION_LABEL: Record<Recommendation["action"], string> = {
  approve: "Suggest approve",
  review: "Suggest manual review",
  decline: "Suggest decline",
};
