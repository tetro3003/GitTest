import { addDays } from "../dates";
import { PERSONAS } from "../mock/personas";
import type { Lender, Share } from "../types";
import type { BorrowerState } from "./store";

export const LENDERS: Lender[] = [
  { id: "city-bank", name: "City Bank", type: "bank", description: "Consumer and auto loans up to ₾30,000" },
  { id: "lari-credit", name: "Lari Credit MFI", type: "mfi", description: "Fast micro-loans for working capital" },
  { id: "drive-leasing", name: "DriveLease", type: "leasing", description: "Car and scooter leasing for gig workers" },
  { id: "black-sea-bank", name: "Black Sea Bank", type: "bank", description: "Equipment and education loans" },
];

/** The lender whose dashboard the demo shows. */
export const DEMO_LENDER_ID = "city-bank";

export const SHARE_SCOPES = ["Score & band", "Verified income", "Reasons", "Fraud checks", "Transactions", "Work activity"];

export function shareCode(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `TL-${h.toString(36).toUpperCase().slice(0, 4).padEnd(4, "X")}-${(h % 9000) + 1000}`;
}

export function seedBorrowers(): Record<string, BorrowerState> {
  const out: Record<string, BorrowerState> = {};
  for (const p of PERSONAS) {
    out[p.borrower.id] = {
      name: p.borrower.name,
      phone: p.borrower.phone,
      workType: p.borrower.workType,
      kycStatus: p.borrower.kycStatus,
      applicationStatus: p.borrower.applicationStatus,
      sources: Object.fromEntries(p.spec.sources.map((s) => [s.id, { status: s.status, connectedAt: s.connectedAt }])),
      items: {},
      uploads: [],
      customSources: [],
    };
  }
  return out;
}

/** Every demo applicant has shared their profile with City Bank, valid for 90 days from seeding. */
export function seedShares(now: Date): Share[] {
  const lender = LENDERS[0];
  const expires = `${addDays(now.toISOString().slice(0, 10), 90)}T23:59:59.000Z`;
  return PERSONAS.map((p) => ({
    id: `share-${p.borrower.id}`,
    borrowerId: p.borrower.id,
    lenderId: lender.id,
    lenderName: lender.name,
    code: shareCode(p.borrower.id),
    scope: SHARE_SCOPES,
    createdAt: `${p.appliedAt}T09:00:00.000Z`,
    expiresAt: expires,
    status: "active",
  }));
}
