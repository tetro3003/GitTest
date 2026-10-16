import { addDays, weekStart } from "../dates";
import type { ActivityRecord, ISODate, WorkEvent, WorkEventKind, WorkItem } from "../types";

/**
 * Turns universal work events (from any app, file, webhook or tracker) into
 * the weekly records and shareable items the Work Checker reads. Pure.
 */

/** Signal each event kind feeds. Kinds without a signal only add hours. */
const SIGNAL_OF: Partial<Record<WorkEventKind, string>> = {
  trip: "trips",
  order: "orders",
  design_session: "sessions",
  design_version: "versions",
  client_comment: "clientComments",
  commit: "commits",
  pr_merged: "prsMerged",
  review: "reviewsByOthers",
  issue: "issuesResolved",
  lesson: "lessons",
  appointment: "appointments",
  no_show: "noShows",
  visit: "visitors",
  service_hair: "hair",
  service_nails: "nails",
  service_other: "otherServices",
  app_session: "sessions",
};

/** Kinds that represent time actually spent working (count towards hours and active days). */
const TIMED: ReadonlySet<WorkEventKind> = new Set<WorkEventKind>(["trip", "order", "shift", "design_session", "worklog", "lesson", "appointment", "app_session", "task", "commit"]);

/** Who the work was for, per kind, so distinct clients/students can be counted. */
const CLIENT_SIGNAL: Partial<Record<WorkEventKind, string>> = { lesson: "students", appointment: "clients" };

export function eventsToActivity(sourceId: string, events: readonly WorkEvent[], asOf?: ISODate): ActivityRecord[] {
  if (!events.length) return [];
  const byWeek = new Map<ISODate, WorkEvent[]>();
  for (const e of events) {
    const ws = weekStart(e.at.slice(0, 10));
    const list = byWeek.get(ws) ?? [];
    list.push(e);
    byWeek.set(ws, list);
  }
  // Fill empty weeks between first and last event so gaps count against consistency.
  const weeks = [...byWeek.keys()].sort();
  const last = asOf ? weekStart(addDays(asOf, -7)) : weeks[weeks.length - 1];
  const end = weeks[weeks.length - 1] > last ? weeks[weeks.length - 1] : last;
  const out: ActivityRecord[] = [];
  for (let ws = weeks[0]; ws <= end; ws = addDays(ws, 7)) {
    const list = byWeek.get(ws) ?? [];
    const signals: Record<string, number> = {};
    let minutes = 0;
    const days = new Set<string>();
    const clients = new Map<string, Set<string>>();
    let units = 0;
    for (const e of list) {
      const n = e.units ?? 1;
      const key = SIGNAL_OF[e.kind];
      if (key) signals[key] = (signals[key] ?? 0) + n;
      if (TIMED.has(e.kind)) {
        minutes += e.minutes;
        if (e.minutes > 0 || e.kind === "commit") days.add(e.at.slice(0, 10));
        units += n;
      }
      if (e.km) signals.km = (signals.km ?? 0) + e.km;
      if (e.amount) signals.earnings = (signals.earnings ?? 0) + e.amount;
      const ck = CLIENT_SIGNAL[e.kind];
      if (ck && e.client) clients.set(ck, (clients.get(ck) ?? new Set()).add(e.client.trim().toLowerCase()));
    }
    if (signals.trips) signals.accepted = signals.accepted ?? signals.trips;
    if (signals.orders) {
      signals.completed = signals.orders;
      signals.assigned = signals.orders;
    }
    if (days.size) signals.activeDays = Math.min(7, days.size);
    for (const [k, set] of clients) signals[k] = set.size;
    out.push({
      weekStart: ws,
      sourceId,
      hoursOnline: Math.round((minutes / 60) * 10) / 10,
      tripsOrOrders: Math.round(units),
      activeContracts: 0,
      rating: null,
      distinctClients: [...clients.values()].reduce((a, s) => a + s.size, 0),
      signals,
    });
  }
  return out;
}

/** Groups events by `item` (file, repo, project, app) into shareable work items. */
export function eventsToItems(sourceId: string, events: readonly WorkEvent[]): WorkItem[] {
  const groups = new Map<string, WorkEvent[]>();
  for (const e of events) {
    if (!e.item) continue;
    groups.set(e.item, [...(groups.get(e.item) ?? []), e]);
  }
  const total = events.reduce((a, e) => a + (e.minutes || 1), 0) || 1;
  return [...groups.entries()].map(([name, list], i) => {
    const stats: Record<string, number> = { hours: Math.round((list.reduce((a, e) => a + e.minutes, 0) / 60) * 10) / 10 };
    for (const e of list) {
      const key = SIGNAL_OF[e.kind];
      if (key) stats[key] = (stats[key] ?? 0) + (e.units ?? 1);
    }
    return {
      id: `${sourceId}-feed-${i + 1}`,
      sourceId,
      name,
      weight: list.reduce((a, e) => a + (e.minutes || 1), 0) / total,
      shared: true,
      lastActivity: list.map((e) => e.at.slice(0, 10)).sort().pop() as string,
      stats,
    };
  });
}

export function eventRange(events: readonly WorkEvent[]): { from: ISODate | null; to: ISODate | null } {
  if (!events.length) return { from: null, to: null };
  const days = events.map((e) => e.at.slice(0, 10)).sort();
  return { from: days[0], to: days[days.length - 1] };
}
