import Anthropic from "@anthropic-ai/sdk";
import { BANK_NAMES, type BankIdentity, type BetaScore, type IdentityCheck, type PaymentFact, type Recommendation, type WorkFact } from "@/lib/beta/types";
import { toolName } from "@/lib/beta/score";
import { aiAvailable } from "./providers/email-extract";

/**
 * A short credit memo for the lender's officer, written ONLY from verified facts.
 * Claude writes it when an Anthropic key is set; if Claude is unavailable,
 * refuses, or errors, a rule-based memo is used and the fallback is recorded.
 */

export interface MemoFacts {
  name: string;
  score: BetaScore;
  recommendation: Recommendation;
  payments: PaymentFact[];
  work: WorkFact[];
  identity: IdentityCheck | null;
  banks: BankIdentity[];
}

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

function facts(f: MemoFacts) {
  const income = f.payments.filter((p) => p.status === "income");
  const sources = [...new Set(income.map((p) => p.chain))];
  const payers = [...new Set(income.map((p) => p.payer))];
  const tools = [...new Set(f.work.filter((w) => w.kind !== "comment").map((w) => w.source))];
  const leftOut = f.payments.filter((p) => p.status !== "income").length;
  return { income, sources, payers, tools, leftOut };
}

export function ruleMemo(f: MemoFacts): string {
  const s = f.score;
  if (!s.ready || s.score == null) return `${f.name} has not yet connected enough verified sources for a score. Missing: ${s.missing.join(" ")}`;
  const x = facts(f);
  const parts: string[] = [];
  parts.push(`${f.name} earns a verified ${usd(s.verifiedMonthlyIncome)} in a typical month (last 6 months), from ${x.payers.length} paying client${x.payers.length === 1 ? "" : "s"}, seen in ${x.sources.slice(0, 4).join(", ")}.`);
  if (x.leftOut) parts.push(`${x.leftOut} transaction${x.leftOut === 1 ? " was" : "s were"} left out as duplicates, own transfers, platform payouts or spam.`);
  if (x.tools.length) parts.push(`Design work is visible in ${x.tools.map(toolName).join(", ")}: active in ${s.features.activeWeeksLast12 ?? 0} of the last 12 weeks, and ${Math.round((s.features.workIncomeMatchRatio ?? 0) * 100)}% of paid months show matching work.`);
  else parts.push("No work tool is connected, so the work behind the income is not proven.");
  const bank = f.banks.find((b) => b.matchesAccount);
  if (bank) parts.push(`Identity confirmed by ${BANK_NAMES[bank.bank]} (account holder ${bank.holderName}).`);
  else if (f.identity?.status === "verified") parts.push(`Identity verified by ID check (${f.identity.name}).`);
  else parts.push("Identity not yet confirmed.");
  parts.push(s.flags.length ? `Risk signals: ${s.flags.map((fl) => fl.title).join("; ")}.` : "No fraud signals were found.");
  parts.push(`Score ${s.score} (band ${s.band}); suggested maximum repayment ${usd(f.recommendation.maxMonthlyPayment)} a month.`);
  return parts.join(" ");
}

let client: Anthropic | null = null;

export async function writeMemo(f: MemoFacts): Promise<{ text: string; by: "claude" | "rules"; note: string | null }> {
  if (!aiAvailable()) return { text: ruleMemo(f), by: "rules", note: "No Anthropic key set: rule-based summary" };
  const x = facts(f);
  const input = {
    applicant: f.name,
    score: f.score.score,
    band: f.score.band,
    verifiedMonthlyIncomeUsd: f.score.verifiedMonthlyIncome,
    suggestedMaxMonthlyPaymentUsd: f.recommendation.maxMonthlyPayment,
    systemSuggestion: f.recommendation.action,
    reasons: f.score.reasons.map((r) => ({ factor: r.label, points: r.impact, detail: r.plain })),
    riskFlags: f.score.flags.map((fl) => `${fl.title}: ${fl.detail}`),
    incomeSources: x.sources,
    payingClients: x.payers.length,
    transactionsLeftOut: x.leftOut,
    workTools: x.tools.map(toolName),
    identity: f.banks.find((b) => b.matchesAccount) ? "confirmed by bank" : f.identity?.status === "verified" ? "verified by ID check" : "not confirmed",
  };
  try {
    client ??= new Anthropic();
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1500,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system:
        "You write a short credit memo (at most 110 words, plain prose, no headings or lists) for a bank loan officer reviewing a freelancer. Use ONLY the verified facts given; never invent numbers. Say what supports lending, then the main risk or gap, then the system's suggestion. The officer makes the decision; do not decide for them.",
      messages: [{ role: "user", content: `Verified facts (JSON):\n${JSON.stringify(input)}` }],
    });
    if (res.stop_reason === "refusal") throw new Error("Claude declined");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new Error("empty answer");
    return { text, by: "claude", note: null };
  } catch (e) {
    return { text: ruleMemo(f), by: "rules", note: `Claude unavailable (${(e as Error).message}): fell back to rule-based summary` };
  }
}
