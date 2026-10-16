import { CHECKERS, isWorkEvidenceType } from "../checker/profiles";
import type { DataSource, SourceStatus, SourceType } from "../types";

/** Catalogue of fictional providers and what each one shares. */
const CATALOGUE: Record<SourceType, { tier: 1 | 2 | 3; optional: boolean; consentDays: number; dataShared: string[] }> = {
  bank: {
    tier: 1,
    optional: false,
    consentDays: 90,
    dataShared: ["Account holder name", "Transactions (up to 24 months)", "Daily balances"],
  },
  ride_hailing: {
    tier: 3,
    optional: true,
    consentDays: 180,
    dataShared: ["Weekly hours online", "Completed trips", "Driver rating", "Payout statements"],
  },
  delivery_platform: {
    tier: 3,
    optional: true,
    consentDays: 180,
    dataShared: ["Weekly hours online", "Completed orders", "Courier rating", "Payout statements"],
  },
  design_tool: { tier: 3, optional: true, consentDays: 180, dataShared: ["Version history of chosen files", "Editing sessions", "Client comments"] },
  dev_tool: { tier: 3, optional: true, consentDays: 180, dataShared: ["Commit & pull-request metadata", "Resolved issues", "Active days"] },
  video_lessons: { tier: 3, optional: true, consentDays: 180, dataShared: ["Lesson times & length", "Number of students"] },
  lesson_audio: { tier: 3, optional: true, consentDays: 90, dataShared: ["Recording length", "Share of time with speech"] },
  booking_app: { tier: 3, optional: true, consentDays: 180, dataShared: ["Appointments", "No-shows", "Client count", "Service types"] },
  salon_sensors: { tier: 3, optional: true, consentDays: 365, dataShared: ["Visitor counts", "Services per station"] },
  utility: {
    tier: 2,
    optional: false,
    consentDays: 365,
    dataShared: ["Bill amounts", "Due dates", "Payment dates"],
  },
  mobile_operator: {
    tier: 2,
    optional: false,
    consentDays: 365,
    dataShared: ["Monthly plan amount", "Payment history"],
  },
  invoice_upload: {
    tier: 3,
    optional: true,
    consentDays: 90,
    dataShared: ["Uploaded invoices", "Client names", "Invoice amounts"],
  },
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  bank: "Bank account",
  ride_hailing: "Ride-hailing platform",
  delivery_platform: "Delivery platform",
  design_tool: "Design tool",
  dev_tool: "Developer tool",
  video_lessons: "Online lessons",
  lesson_audio: "Offline lesson audio",
  booking_app: "Booking app",
  salon_sensors: "Salon sensors (pilot)",
  utility: "Utility bills",
  mobile_operator: "Mobile operator",
  invoice_upload: "Invoices",
};

export function makeSource(
  id: string,
  type: SourceType,
  provider: string,
  opts: { accountHolderName?: string; connectedAt?: string; status?: SourceStatus } = {},
): DataSource {
  const c = CATALOGUE[type];
  const status = opts.status ?? "connected";
  // Work tools list exactly what the Work Checker reads from that app.
  const tracks = CHECKERS.flatMap((ch) => ch.sources).find((s) => s.provider === provider)?.tracks;
  return {
    id,
    type,
    provider,
    status,
    connectedAt: status === "connected" ? (opts.connectedAt ?? "2026-09-28T10:00:00.000Z") : null,
    tier: c.tier,
    accountHolderName: opts.accountHolderName,
    dataShared: tracks ?? c.dataShared,
    consentDays: c.consentDays,
    optional: c.optional,
  };
}

export function isActivitySource(t: SourceType): boolean {
  return isWorkEvidenceType(t);
}
