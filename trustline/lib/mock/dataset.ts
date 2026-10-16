import { DEMO_AS_OF } from "../config";
import type { ActivityRecord, DataSource, ScoringInput, WorkItem } from "../types";
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
export function buildScoringInput(
  def: PersonaDefinition,
  connected: DataSource[],
  asOf = DEMO_AS_OF,
  itemOverrides: Record<string, boolean> = {},
  extraItems: WorkItem[] = [],
): ScoringInput {
  const data = getPersonaData(def.borrower.id);
  const ids = new Set(connected.filter((s) => s.status === "connected").map((s) => s.id));
  const items = [...data.workItems, ...extraItems]
    .filter((i) => ids.has(i.sourceId))
    .map((i) => ({ ...i, shared: itemOverrides[i.id] ?? i.shared }));
  // Only the share of activity that comes from items the user chose to share counts.
  const shareOf = new Map<string, number>();
  for (const id of ids) {
    const own = items.filter((i) => i.sourceId === id && !i.id.includes("-upload-"));
    if (own.length) shareOf.set(id, own.filter((i) => i.shared).reduce((a, i) => a + i.weight, 0));
  }
  const scale = (r: ActivityRecord): ActivityRecord => {
    const f = shareOf.get(r.sourceId);
    if (f === undefined || f >= 0.999) return r;
    const signals: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.signals)) signals[k] = Math.round(v * f);
    return { ...r, hoursOnline: Math.round(r.hoursOnline * f * 10) / 10, tripsOrOrders: Math.round(r.tripsOrOrders * f), signals };
  };
  // Uploaded lesson recordings add measured teaching minutes to the latest week.
  const uploads = items.filter((i) => i.id.includes("-upload-") && i.shared);
  const activity = data.activity.filter((a) => ids.has(a.sourceId)).map(scale);
  if (uploads.length && activity.length) {
    const target = [...activity].reverse().find((a) => uploads.some((u) => u.sourceId === a.sourceId));
    if (target) {
      const add = (k: string, v: number) => (target.signals = { ...target.signals, [k]: (target.signals[k] ?? 0) + v });
      for (const u of uploads) {
        add("recordings", 1);
        add("recordedMinutes", u.stats.recordedMinutes ?? 0);
        add("speechMinutes", u.stats.speechMinutes ?? 0);
      }
    }
  }
  return {
    borrower: { id: def.borrower.id, name: def.borrower.name, workType: def.borrower.workType },
    sources: def.spec.sources.filter((s) => ids.has(s.id)),
    transactions: data.transactions.filter((t) => ids.has(t.sourceId)),
    activity,
    workItems: items,
    obligations: data.obligations.filter((o) => ids.has(o.sourceId)),
    invoices: data.invoices.filter((i) => ids.has(i.sourceId)),
    asOf,
  };
}

export function allPersonaIds(): string[] {
  return PERSONAS.map((p) => p.borrower.id);
}
