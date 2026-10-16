import { DEMO_AS_OF } from "../config";
import { checkerFor } from "../checker/profiles";
import { addDays, weekStart } from "../dates";
import { weeklyTotals } from "../scoring/activity";
import type { ActivityRecord, DataSource, ScoringInput, WorkItem, WorkType } from "../types";
import { buildWorkItems, generatePersonaData, professionSignals, type ActivitySourceSpec, type GeneratedData } from "./generator";
import { createRng } from "./rng";
import { isActivitySource, makeSource } from "./sources";
import { getPersona, PERSONAS, type PersonaDefinition } from "./personas";

const cache = new Map<string, GeneratedData>();

/**
 * How a profession's work apps split someone's hours, and the example things
 * (files, repos, lesson series) they can share. Used when a borrower picks a
 * profession other than the demo persona's own.
 */
const PROFESSION_TOOLS: Partial<Record<WorkType, { provider: string; share: number; items?: string[] }[]>> = {
  taxi: [{ provider: "Bolt Driver", share: 0.7 }, { provider: "Uber Driver", share: 0.3 }],
  delivery: [{ provider: "Wolt Partner", share: 0.6 }, { provider: "Glovo Courier", share: 0.4 }],
  designer: [
    { provider: "Figma", share: 0.65, items: ["Client app redesign", "E-shop checkout flow", "Design system"] },
    { provider: "Adobe Photoshop", share: 0.2, items: ["Product photos.psd", "Social media banners.psd"] },
    { provider: "Adobe Illustrator", share: 0.15, items: ["Logo refresh.ai", "Icon set.ai"] },
  ],
  developer: [
    { provider: "GitHub", share: 0.85, items: ["client/web-app", "client/mobile-api", "client/admin-panel"] },
    { provider: "Jira", share: 0.15, items: ["WEB — Client website", "API — Mobile backend"] },
  ],
  tutor: [
    { provider: "Zoom", share: 0.5, items: ["Online lessons — group A", "Online lessons — group B"] },
    { provider: "Google Meet", share: 0.2, items: ["One-to-one lessons"] },
    { provider: "Offline lesson audio", share: 0.3, items: ["Home lesson recording 1", "Home lesson recording 2"] },
  ],
  beauty: [{ provider: "Booksy", share: 0.7 }, { provider: "Fresha", share: 0.3 }, { provider: "Salon sensors", share: 0 }],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function toolSpecs(id: string, workType: WorkType): ActivitySourceSpec[] {
  const checker = checkerFor(workType);
  return (PROFESSION_TOOLS[workType] ?? []).flatMap((t) => {
    const def = checker?.sources.find((x) => x.provider === t.provider);
    if (!def) return [];
    return [{ id: `${id}-w-${slug(t.provider)}`, type: def.type, provider: t.provider, share: t.share, items: t.items?.map((name, i) => ({ name, weight: 3 - i * 0.7 })) }];
  });
}

/**
 * The sources a borrower can connect for the given profession: the persona's
 * bank, bills and invoices, plus that profession's work apps.
 */
export function sourceCatalogue(id: string, workType?: WorkType): DataSource[] {
  const def = getPersona(id);
  if (!def) throw new Error(`Unknown persona: ${id}`);
  const wt = workType ?? def.borrower.workType;
  if (wt === def.borrower.workType) return def.spec.sources;
  const base = def.spec.sources.filter((s) => !isActivitySource(s.type));
  return [...base, ...toolSpecs(id, wt).map((t) => makeSource(t.id, t.type, t.provider, { status: "available" }))];
}

/** Raw synthetic data for a persona, generated once and cached. */
export function getPersonaData(id: string, workType?: WorkType): GeneratedData {
  const def = getPersona(id);
  if (!def) throw new Error(`Unknown persona: ${id}`);
  const wt = workType ?? def.borrower.workType;
  const key = `${id}|${wt}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let data: GeneratedData;
  if (wt === def.borrower.workType) {
    data = generatePersonaData(id, def.spec, DEMO_AS_OF);
  } else {
    // Same person, same working hours, re-expressed in the new profession's apps.
    const base = getPersonaData(id);
    const rng = createRng(def.spec.seed ^ 0x7a11);
    let weeks = weeklyTotals(base.activity).map((w) => ({ weekStart: w.weekStart, hours: w.hours }));
    if (!weeks.length) {
      const last = weekStart(addDays(DEMO_AS_OF, -7));
      weeks = Array.from({ length: def.spec.historyMonths * 4 }, (_, k) => ({ weekStart: addDays(last, -7 * (def.spec.historyMonths * 4 - 1 - k)), hours: Math.round(rng.normal(36, 3) * 10) / 10 }));
    }
    const specs = toolSpecs(id, wt);
    const activity: ActivityRecord[] = [];
    for (const w of weeks) {
      for (const src of specs) {
        const h = Math.round(w.hours * src.share * 10) / 10;
        activity.push({ weekStart: w.weekStart, sourceId: src.id, hoursOnline: h, tripsOrOrders: 0, activeContracts: 0, rating: null, distinctClients: Math.round(w.hours * 0.4), signals: professionSignals(src, h, w.hours, Math.round(w.hours * 0.4), rng) });
      }
    }
    data = { ...base, activity, workItems: buildWorkItems(specs, activity, DEMO_AS_OF, rng) };
  }
  cache.set(key, data);
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
  const data = getPersonaData(def.borrower.id, def.borrower.workType);
  const catalogue = sourceCatalogue(def.borrower.id, def.borrower.workType);
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
    sources: catalogue.filter((s) => ids.has(s.id)),
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
