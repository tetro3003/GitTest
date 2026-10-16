import type { DataSource, SourceType } from "../types";

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
  freelance_platform: {
    tier: 3,
    optional: true,
    consentDays: 180,
    dataShared: ["Active contracts", "Tracked hours", "Client count", "Client reviews"],
  },
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
  freelance_platform: "Freelance platform",
  utility: "Utility bills",
  mobile_operator: "Mobile operator",
  invoice_upload: "Invoices",
};

export function makeSource(
  id: string,
  type: SourceType,
  provider: string,
  opts: { accountHolderName?: string; connectedAt?: string } = {},
): DataSource {
  const c = CATALOGUE[type];
  return {
    id,
    type,
    provider,
    status: "connected",
    connectedAt: opts.connectedAt ?? "2026-09-28T10:00:00.000Z",
    tier: c.tier,
    accountHolderName: opts.accountHolderName,
    dataShared: c.dataShared,
    consentDays: c.consentDays,
    optional: c.optional,
  };
}

export function isActivitySource(t: SourceType): boolean {
  return t === "ride_hailing" || t === "delivery_platform" || t === "freelance_platform";
}
