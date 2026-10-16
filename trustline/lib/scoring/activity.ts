import type { ActivityRecord, ISODate } from "../types";

export interface WeekTotal {
  weekStart: ISODate;
  hours: number;
  trips: number;
  rating: number | null;
}

/** Sums records from all work tools into one row per week, oldest first. */
export function weeklyTotals(activity: readonly ActivityRecord[]): WeekTotal[] {
  const m = new Map<ISODate, WeekTotal>();
  for (const a of activity) {
    const w = m.get(a.weekStart) ?? { weekStart: a.weekStart, hours: 0, trips: 0, rating: null };
    w.hours = Math.round((w.hours + a.hoursOnline) * 10) / 10;
    w.trips += a.tripsOrOrders;
    w.rating = w.rating ?? a.rating;
    m.set(a.weekStart, w);
  }
  return [...m.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}
