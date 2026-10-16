import type { WorkEvent, WorkEventKind, WorkType } from "../types";
import { parseDateTime, parseDuration, parseNumber } from "./importer";

/**
 * Normalises events posted to the webhook (Zapier, Make, IFTTT, salon
 * sensors, the desktop tracker, custom scripts). Accepts one event, an array,
 * or { events: [...] }, with flexible field names. Pure.
 */
export const MAX_INGEST_EVENTS = 1000;

const KINDS = new Set<WorkEventKind>([
  "trip", "order", "shift", "design_session", "design_version", "client_comment", "commit", "pr_merged", "review", "issue",
  "worklog", "lesson", "appointment", "no_show", "visit", "service_hair", "service_nails", "service_other", "app_session", "task",
]);

const DEFAULT_KIND: Record<WorkType, WorkEventKind> = {
  taxi: "trip", delivery: "order", designer: "design_session", developer: "worklog", tutor: "lesson", beauty: "appointment", repair: "task", other: "task",
};

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

export interface IngestResult {
  events: WorkEvent[];
  rejected: { index: number; reason: string }[];
}

export function normalizeIncomingEvents(body: unknown, workType: WorkType): IngestResult {
  const list: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? ((body as { events: unknown[] }).events)
      : body && typeof body === "object"
        ? [body]
        : [];
  if (list.length > MAX_INGEST_EVENTS) throw new Error(`Send at most ${MAX_INGEST_EVENTS} events per request.`);
  const events: WorkEvent[] = [];
  const rejected: IngestResult["rejected"] = [];
  list.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return rejected.push({ index, reason: "not an object" });
    const o = raw as Record<string, unknown>;
    const atRaw = pick(o, ["at", "start", "started_at", "startedAt", "date", "time", "timestamp", "created_at"]);
    const at = atRaw === undefined ? new Date().toISOString() : parseDateTime(String(atRaw));
    if (!at) return rejected.push({ index, reason: "unreadable date in 'at'" });
    const kindRaw = String(pick(o, ["kind", "type"]) ?? "").toLowerCase();
    const kind = (KINDS.has(kindRaw as WorkEventKind) ? kindRaw : DEFAULT_KIND[workType]) as WorkEventKind;
    const minutesRaw = pick(o, ["minutes", "duration_minutes", "durationMinutes"]);
    const hoursRaw = pick(o, ["hours"]);
    const secondsRaw = pick(o, ["seconds", "duration_seconds"]);
    const durRaw = pick(o, ["duration"]);
    let minutes =
      minutesRaw !== undefined ? parseNumber(String(minutesRaw))
      : hoursRaw !== undefined ? (parseNumber(String(hoursRaw)) ?? 0) * 60
      : secondsRaw !== undefined ? (parseNumber(String(secondsRaw)) ?? 0) / 60
      : durRaw !== undefined ? parseDuration(String(durRaw), false)
      : 0;
    if (minutes === null || minutes < 0) return rejected.push({ index, reason: "minutes must be a positive number" });
    minutes = Math.min(minutes, 16 * 60);
    const num = (keys: string[]) => {
      const v = pick(o, keys);
      const n = v === undefined ? null : parseNumber(String(v));
      return n !== null && n > 0 ? n : undefined;
    };
    const str = (keys: string[]) => {
      const v = pick(o, keys);
      return v === undefined ? undefined : String(v).slice(0, 80);
    };
    const e: WorkEvent = { at, minutes: Math.round(minutes * 10) / 10, kind };
    const units = num(["units", "count", "quantity"]);
    const amount = num(["amount", "earnings", "fare", "price", "total"]);
    const km = num(["km", "distance_km", "distance"]);
    const client = str(["client", "customer", "student", "passenger"]);
    const item = str(["item", "project", "file", "app", "repo", "service"]);
    if (units) e.units = units;
    if (amount) e.amount = Math.round(amount * 100) / 100;
    if (km) e.km = km;
    if (client) e.client = client;
    if (item) e.item = item;
    events.push(e);
  });
  return { events, rejected };
}
