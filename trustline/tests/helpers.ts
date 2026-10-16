import { buildScoringInput } from "@/lib/mock/dataset";
import { getPersona } from "@/lib/mock/personas";
import { isActivitySource } from "@/lib/mock/sources";
import { computeScoreReport } from "@/lib/scoring";
import type { DataSource, ScoringInput, Transaction } from "@/lib/types";

export function personaInput(id: string, filter: (s: DataSource) => boolean = () => true): ScoringInput {
  const p = getPersona(id);
  if (!p) throw new Error(`no persona ${id}`);
  return buildScoringInput(p, p.spec.sources.filter(filter));
}

export const reportFor = (id: string, filter?: (s: DataSource) => boolean) => computeScoreReport(personaInput(id, filter));
export const withoutActivity = (s: DataSource) => !isActivitySource(s.type);

let n = 0;
export function tx(p: Partial<Transaction> & Pick<Transaction, "date" | "amount" | "direction">): Transaction {
  return { id: `t${++n}`, counterparty: "X", category: "other", sourceId: "bank", balanceAfter: 500, ...p };
}

export function emptyInput(over: Partial<ScoringInput> = {}): ScoringInput {
  return {
    borrower: { id: "b", name: "Ana Test", workType: "delivery" },
    sources: [{ id: "bank", type: "bank", provider: "Bank", status: "connected", connectedAt: null, tier: 1, accountHolderName: "Ana Test", dataShared: [], consentDays: 90, optional: false }],
    transactions: [],
    activity: [],
    obligations: [],
    invoices: [],
    asOf: "2026-10-01",
    ...over,
  };
}
