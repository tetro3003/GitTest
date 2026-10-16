import { DEMO_AS_OF } from "../config";
import type { DataSource, ScoringInput } from "../types";
import { generatePersonaData, type GeneratedData } from "./generator";
import { getPersona, PERSONAS, type PersonaDefinition } from "./personas";

const cache = new Map<string, GeneratedData>();

/** Raw synthetic data for a persona (all sources), generated once and cached. */
export function getPersonaData(id: string): GeneratedData {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = getPersona(id);
  if (!def) throw new Error(`Unknown persona: ${id}`);
  const data = generatePersonaData(id, def.spec, DEMO_AS_OF);
  cache.set(id, data);
  return data;
}

/** Build the engine input using only data from sources the borrower connected. */
export function buildScoringInput(def: PersonaDefinition, connected: DataSource[], asOf = DEMO_AS_OF): ScoringInput {
  const data = getPersonaData(def.borrower.id);
  const ids = new Set(connected.filter((s) => s.status === "connected").map((s) => s.id));
  return {
    borrower: { id: def.borrower.id, name: def.borrower.name, workType: def.borrower.workType },
    sources: def.spec.sources.filter((s) => ids.has(s.id)),
    transactions: data.transactions.filter((t) => ids.has(t.sourceId)),
    activity: data.activity.filter((a) => ids.has(a.sourceId)),
    obligations: data.obligations.filter((o) => ids.has(o.sourceId)),
    invoices: data.invoices.filter((i) => ids.has(i.sourceId)),
    asOf,
  };
}

export function allPersonaIds(): string[] {
  return PERSONAS.map((p) => p.borrower.id);
}
