import type { ImportSummary, WorkEvent, WorkEventKind, WorkType } from "../types";
import { eventRange } from "./aggregate";

/**
 * Universal export importer. Reads a CSV or JSON export from any app (Bolt
 * earnings, Booksy appointments, Zoom meeting report, Jira worklog, Toggl…),
 * finds the date / duration / amount / client columns by their headers and
 * turns every row into a WorkEvent. Pure and framework-free.
 */

export const MAX_IMPORT_ROWS = 20_000;

type Row = Record<string, string>;

/* ---------------- parsing ---------------- */

export function parseCsv(text: string): Row[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? clean.length : clean.indexOf("\n"));
  const delim = [",", ";", "\t", "|"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      cur.push(field);
      field = "";
    } else if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function parseJson(text: string): Row[] {
  const data: unknown = JSON.parse(text);
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (Object.values(data as Record<string, unknown>).find((v) => Array.isArray(v)) as unknown[] | undefined) ?? []
      : [];
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)])));
}

/* ---------------- value parsers ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts ISO, "DD.MM.YYYY HH:mm", "DD/MM/YYYY", "MM/DD/YYYY" (when unambiguous) and Unix seconds/ms. */
export function parseDateTime(v: string, preferDayFirst = true): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{10}(\d{3})?$/.test(s)) {
    const d = new Date(Number(s) * (s.length === 10 ? 1000 : 1));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return build(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    let h = +(m[4] ?? 0);
    if (m[7]?.toLowerCase() === "pm" && h < 12) h += 12;
    if (m[7]?.toLowerCase() === "am" && h === 12) h = 0;
    // a = day, b = month unless the numbers say otherwise.
    if (a <= 12 && b > 12) [a, b] = [b, a];
    else if (!preferDayFirst) [a, b] = [b, a];
    return build(y, b, a, h, +(m[5] ?? 0), +(m[6] ?? 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function build(y: number, mo: number, d: number, h: number, mi: number, se: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(se)}.000Z`;
}

/** "90", "1:30", "01:30:00", "1h 30m", "1.5" (when the header says hours). Returns minutes. */
export function parseDuration(v: string, headerSaysHours: boolean, headerSaysSeconds = false): number | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
  m = s.match(/^(?:(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/);
  if (m && (m[1] || m[2])) return (m[1] ? parseFloat(m[1].replace(",", ".")) * 60 : 0) + (m[2] ? +m[2] : 0);
  const n = parseNumber(s);
  if (n === null) return null;
  return headerSaysSeconds ? n / 60 : headerSaysHours ? n * 60 : n;
}

/** "₾1,234.50", "1.234,50", "-12", "GEL 45" → number. */
export function parseNumber(v: string): number | null {
  let s = v.replace(/[^\d,.\-]/g, "");
  if (!s || s === "-" ) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/* ---------------- column detection ---------------- */

const norm = (h: string) => h.toLowerCase().replace(/[_\-]+/g, " ").trim();

const SYNONYMS = {
  start: ["start", "started", "begin", "pickup time", "pick up", "order time", "trip date", "date", "time", "created", "timestamp", "appointment", "scheduled", "when", "day"],
  end: ["end", "ended", "finish", "drop off", "dropoff", "delivered", "completed at", "stop"],
  duration: ["duration", "minutes", "mins", "hours", "time spent", "online time", "length", "logged", "time logged", "worked"],
  amount: ["earning", "net", "payout", "fare", "amount", "total", "price", "income", "revenue", "paid", "sum", "tip"],
  client: ["client", "customer", "student", "passenger", "participant", "attendee", "guest", "patient", "requester"],
  distance: ["distance", "km", "kilomet", "mileage", "miles"],
  status: ["status", "state", "outcome", "result"],
  type: ["service", "type", "category", "activity", "event", "kind"],
  item: ["project", "file", "repo", "repository", "issue key", "issue", "course", "subject", "topic", "meeting", "app", "application", "task", "description"],
  units: ["trips", "orders", "quantity", "qty", "count", "deliveries", "lessons"],
} as const;

type Field = keyof typeof SYNONYMS;

function detectColumns(rows: Row[]): Partial<Record<Field, string>> {
  const headers = Object.keys(rows[0] ?? {});
  const used = new Set<string>();
  const pick = (field: Field, ok?: (h: string) => boolean): string | undefined => {
    for (const syn of SYNONYMS[field]) {
      const h = headers.find((x) => !used.has(x) && norm(x).includes(syn) && (!ok || ok(x)));
      if (h) {
        used.add(h);
        return h;
      }
    }
    return undefined;
  };
  const sample = rows.slice(0, 50);
  const dateLike = (h: string) => sample.filter((r) => parseDateTime(r[h] ?? "")).length >= sample.length * 0.6;
  const numLike = (h: string) => sample.filter((r) => parseNumber(r[h] ?? "") !== null).length >= sample.length * 0.6;
  const durLike = (h: string) => sample.filter((r) => parseDuration(r[h] ?? "", false) !== null).length >= sample.length * 0.6;
  const cols: Partial<Record<Field, string>> = {};
  cols.end = pick("end", dateLike);
  cols.start = pick("start", dateLike);
  cols.duration = pick("duration", durLike);
  cols.amount = pick("amount", numLike);
  cols.distance = pick("distance", numLike);
  cols.units = pick("units", numLike);
  cols.client = pick("client");
  cols.status = pick("status");
  cols.type = pick("type");
  cols.item = pick("item");
  if (!cols.start && cols.end) {
    cols.start = cols.end;
    cols.end = undefined;
  }
  return cols;
}

/* ---------------- row → event ---------------- */

const DEFAULT_KIND: Record<WorkType, WorkEventKind> = {
  taxi: "trip",
  delivery: "order",
  designer: "design_session",
  developer: "worklog",
  tutor: "lesson",
  beauty: "appointment",
  repair: "task",
  other: "task",
};

/** Typical minutes per event when the export has no duration. */
const DEFAULT_MINUTES: Partial<Record<WorkEventKind, number>> = { trip: 25, order: 20, lesson: 60, appointment: 60, design_session: 60, worklog: 60, task: 60, app_session: 30 };

function kindFor(base: WorkEventKind, type: string): WorkEventKind {
  const t = type.toLowerCase();
  if (!t) return base;
  if (base === "worklog" || base === "task") {
    if (/commit/.test(t)) return "commit";
    if (/pull|merge|\bpr\b/.test(t)) return "pr_merged";
    if (/review/.test(t)) return "review";
    if (/issue|ticket|bug|story/.test(t)) return "issue";
  }
  if (base === "design_session" && /comment/.test(t)) return "client_comment";
  if (base === "design_session" && /version|checkpoint|save/.test(t)) return "design_version";
  return base;
}

export interface ImportResult {
  events: WorkEvent[];
  summary: ImportSummary;
}

export function importWorkExport(fileName: string, text: string, workType: WorkType): ImportResult {
  const warnings: string[] = [];
  let rows: Row[];
  try {
    rows = /^\s*[[{]/.test(text) ? parseJson(text) : parseCsv(text);
  } catch {
    throw new Error("We couldn't read this file. Export it from the app as CSV or JSON and try again.");
  }
  if (!rows.length) throw new Error("The file has no rows. Check that you exported your work history, not an empty report.");
  if (rows.length > MAX_IMPORT_ROWS) {
    warnings.push(`Only the first ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows were read.`);
    rows = rows.slice(0, MAX_IMPORT_ROWS);
  }
  const cols = detectColumns(rows);
  if (!cols.start) throw new Error("We couldn't find a date column. The file needs a column like “Date”, “Start time” or “Created at”.");

  const dayFirst = !rows.slice(0, 200).some((r) => {
    const m = (r[cols.start as string] ?? "").match(/^(\d{1,2})[./-](\d{1,2})[./-]/);
    return m ? +m[2] > 12 : false;
  });
  const durHeader = cols.duration ? norm(cols.duration) : "";
  const durHours = /hour|hrs/.test(durHeader);
  const durSeconds = /sec/.test(durHeader);
  const base = DEFAULT_KIND[workType];

  const events: WorkEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    const at = parseDateTime(r[cols.start] ?? "", dayFirst);
    if (!at) {
      skipped++;
      continue;
    }
    const status = cols.status ? (r[cols.status] ?? "").toLowerCase() : "";
    if (/cancel|reject|declin|fail|refund/.test(status)) {
      skipped++;
      continue;
    }
    let kind = kindFor(base, cols.type ? (r[cols.type] ?? "") : "");
    if (/no.?show|missed|absent/.test(status)) kind = base === "appointment" || base === "lesson" ? "no_show" : kind;
    let minutes = cols.duration ? parseDuration(r[cols.duration] ?? "", durHours, durSeconds) : null;
    if (minutes === null && cols.end) {
      const end = parseDateTime(r[cols.end] ?? "", dayFirst);
      if (end) minutes = Math.max(0, (Date.parse(end) - Date.parse(at)) / 60000);
    }
    if (minutes === null || minutes > 16 * 60) minutes = kind === "no_show" ? 0 : (DEFAULT_MINUTES[kind] ?? 30);
    const units = cols.units ? (parseNumber(r[cols.units] ?? "") ?? undefined) : undefined;
    const amount = cols.amount ? (parseNumber(r[cols.amount] ?? "") ?? undefined) : undefined;
    const km = cols.distance ? (parseNumber(r[cols.distance] ?? "") ?? undefined) : undefined;
    events.push({
      at,
      minutes: Math.round(minutes * 10) / 10,
      kind,
      ...(units !== undefined && units > 0 ? { units } : {}),
      ...(amount !== undefined && amount > 0 ? { amount: Math.round(amount * 100) / 100 } : {}),
      ...(km !== undefined && km > 0 ? { km } : {}),
      ...(cols.client && r[cols.client] ? { client: r[cols.client] } : {}),
      ...(cols.item && r[cols.item] ? { item: r[cols.item].slice(0, 80) } : {}),
    });
  }
  if (!events.length) throw new Error("No rows had a readable date. Check the file's date format.");
  if (skipped) warnings.push(`${skipped} row(s) skipped (cancelled, or no readable date).`);
  if (!cols.duration && !cols.end) warnings.push("No duration column found — typical durations were used, so hours are estimates.");
  if (!cols.amount) warnings.push("No earnings column found — the bank cross-check can't run for this file.");

  const kinds: Partial<Record<WorkEventKind, number>> = {};
  for (const e of events) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  const columns: Record<string, string> = {};
  for (const [k, v] of Object.entries(cols)) if (v) columns[k] = v;
  return {
    events,
    summary: {
      fileName,
      rows: rows.length,
      imported: events.length,
      skipped,
      columns,
      ...eventRange(events),
      hours: Math.round(events.reduce((a, e) => a + e.minutes, 0) / 6) / 10,
      amount: Math.round(events.reduce((a, e) => a + (e.amount ?? 0), 0)),
      kinds,
      warnings,
    },
  };
}
