import type { ISODate, MonthKey } from "./types";

/** Pure UTC date helpers so results never depend on the viewer's timezone. */

export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, days: number): ISODate {
  const dt = parseDate(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatISO(dt);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function monthKey(d: ISODate): MonthKey {
  return d.slice(0, 7);
}

export function addMonths(m: MonthKey, n: number): MonthKey {
  const [y, mo] = m.split("-").map(Number);
  const total = y * 12 + (mo - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** The `count` full months ending the month before `asOf`, oldest first. */
export function lastMonths(asOf: ISODate, count: number): MonthKey[] {
  const end = addMonths(monthKey(asOf), -1);
  return Array.from({ length: count }, (_, i) => addMonths(end, i - count + 1));
}

export function daysInMonth(m: MonthKey): number {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function monthIndex(m: MonthKey): number {
  return Number(m.slice(5, 7)) - 1;
}

/** Monday on or before the date. */
export function weekStart(d: ISODate): ISODate {
  const dt = parseDate(d);
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return formatISO(dt);
}
