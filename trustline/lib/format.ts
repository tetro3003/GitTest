import { CURRENCY, SEGMENT_BENCHMARKS } from "./config";
import type { Band, Decision, Severity, WorkType } from "./types";

export function formatMoney(x: number, opts: { compact?: boolean } = {}): string {
  const n = Math.round(x);
  if (opts.compact && Math.abs(n) >= 1000) return `${CURRENCY.symbol}${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n < 0 ? "−" : ""}${CURRENCY.symbol}${Math.abs(n).toLocaleString(CURRENCY.locale)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(m: string, withYear = false): string {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1]}${withYear ? ` ${y.slice(2)}` : ""}`;
}

export function formatDate(d: string): string {
  const [y, mo, day] = d.slice(0, 10).split("-");
  return `${Number(day)} ${MONTHS[Number(mo) - 1]} ${y}`;
}

export function formatPct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  taxi: "Taxi driver",
  delivery: "Courier",
  designer: "UI/UX designer",
  developer: "Software developer",
  tutor: "Tutor",
  beauty: "Beauty specialist",
  repair: "Repair worker",
  other: "Other self-employed",
};

export const BAND_META: Record<Band, { label: string; tone: "positive" | "default" | "warning" | "risk"; color: string; range: string }> = {
  A: { label: "Excellent", tone: "positive", color: "var(--positive)", range: "740+" },
  B: { label: "Good", tone: "positive", color: "oklch(0.66 0.12 175)", range: "670–739" },
  C: { label: "Fair", tone: "warning", color: "var(--warning)", range: "600–669" },
  D: { label: "Weak", tone: "risk", color: "oklch(0.65 0.17 45)", range: "530–599" },
  E: { label: "High risk", tone: "risk", color: "var(--risk)", range: "<530" },
};

export const DECISION_META: Record<Decision, { label: string; tone: "positive" | "warning" | "risk" }> = {
  approve: { label: "Approve", tone: "positive" },
  review: { label: "Manual review", tone: "warning" },
  decline: { label: "Decline", tone: "risk" },
};

export const SEVERITY_TONE: Record<Severity, "muted" | "warning" | "risk"> = { low: "muted", medium: "warning", high: "risk" };

export const segmentLabel = (w: WorkType) => SEGMENT_BENCHMARKS[w].label;
