import { shareDistinctiveWord } from "./names";
import type { PaymentFact, PaymentSource, WorkFact } from "./types";

/**
 * Before scoring, all payments from every source are looked at together:
 *  - the same payment seen twice (Upwork email + bank deposit) counts once;
 *  - a bank deposit that is a payout from Upwork/PayPal/Wise/an exchange counts only
 *    where the client paid, if that source is connected;
 *  - wallet rules (own wallets, exchanges, dust) are applied by the caller first.
 */

const PLATFORM_SOURCE: [RegExp, PaymentSource][] = [
  [/upwork|fiverr|paypal|payoneer/i, "email"],
  [/\bwise\b|transferwise/i, "wise"],
  [/binance|bybit|okx|kraken|coinbase|kucoin|bitget|mexc/i, "wallet"],
];

const PRIORITY: Record<PaymentSource, number> = { email: 3, wise: 3, wallet: 2, bank: 1 };
export const DUPLICATE_TOLERANCE = { amount: 0.04, days: 7 };

export function reconcilePayments<T extends PaymentFact & { connectionId?: string }>(payments: readonly T[]): T[] {
  const sources = new Set(payments.map((p) => p.source));
  const out = payments.map((p) => ({ ...p }));

  for (const p of out) {
    if (p.source !== "bank" || p.status !== "income") continue;
    const hit = PLATFORM_SOURCE.find(([re]) => re.test(p.payer));
    if (!hit) continue;
    const name = p.payer.match(hit[0])![0];
    if (sources.has(hit[1])) Object.assign(p, { status: "own_transfer", note: `Payout from ${name}: already counted where the client paid` });
    else p.note = `Payout from ${name}: the client behind it isn't visible yet${p.note ? ` · ${p.note}` : ""}`;
  }

  const income = out.filter((p) => p.status === "income").sort((a, b) => PRIORITY[b.source] - PRIORITY[a.source]);
  for (let i = 0; i < income.length; i++) {
    const keep = income[i];
    if (keep.status !== "income") continue;
    for (let j = i + 1; j < income.length; j++) {
      const other = income[j];
      if (other.status !== "income" || other.source === keep.source) continue;
      const days = Math.abs(new Date(other.at).getTime() - new Date(keep.at).getTime()) / 864e5;
      const diff = Math.abs(other.amountUsd - keep.amountUsd) / Math.max(keep.amountUsd, 1);
      if (days <= DUPLICATE_TOLERANCE.days && diff <= DUPLICATE_TOLERANCE.amount)
        Object.assign(other, { status: "duplicate", note: `Same payment as ${keep.chain} on ${keep.at.slice(0, 10)}: counted once` });
    }
  }
  return out;
}

/** Payers that also appear in the work (a Figma commenter, a Miro collaborator, a client's Webflow domain, a file name). */
export function matchClients(payments: readonly PaymentFact[], work: readonly WorkFact[]): { payer: string; evidence: string }[] {
  const payers = [...new Set(payments.filter((p) => p.status === "income").map((p) => p.payer))];
  const names = [...new Set(work.flatMap((w) => [w.person, w.item]).filter((x): x is string => !!x))];
  const out: { payer: string; evidence: string }[] = [];
  for (const payer of payers) {
    for (const n of names) {
      const word = shareDistinctiveWord(payer, n);
      if (word) {
        out.push({ payer, evidence: n });
        break;
      }
    }
  }
  return out;
}
