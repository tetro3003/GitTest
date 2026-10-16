import { DEMO_AS_OF } from "../config";
import { addDays } from "../dates";
import type { ApplicationStatus, Consent, DataSource, KycStatus, Lender, Share, SourceStatus, WorkType } from "../types";
import { PERSONAS } from "./personas";

/**
 * In-memory "server state" for the mock adapter, persisted to localStorage so a
 * page reload during a demo keeps what was connected and shared.
 */
export interface BorrowerState {
  name: string;
  phone: string;
  workType: WorkType;
  kycStatus: KycStatus;
  applicationStatus: ApplicationStatus;
  sources: Record<string, { status: SourceStatus; connectedAt: string | null }>;
}

export interface DemoDb {
  version: number;
  borrowers: Record<string, BorrowerState>;
  shares: Share[];
  /** Probability (0–1) that a mock call fails, to show error states. */
  failRate: number;
}

const STORAGE_KEY = "trustline-demo-db";
const DB_VERSION = 1;

export const LENDERS: Lender[] = [
  { id: "city-bank", name: "City Bank", type: "bank", description: "Consumer and auto loans up to ₾30,000" },
  { id: "lari-credit", name: "Lari Credit MFI", type: "mfi", description: "Fast micro-loans for working capital" },
  { id: "drive-leasing", name: "DriveLease", type: "leasing", description: "Car and scooter leasing for gig workers" },
  { id: "black-sea-bank", name: "Black Sea Bank", type: "bank", description: "Equipment and education loans" },
];

function seedDb(): DemoDb {
  const borrowers: Record<string, BorrowerState> = {};
  for (const p of PERSONAS) {
    borrowers[p.borrower.id] = {
      name: p.borrower.name,
      phone: p.borrower.phone,
      workType: p.borrower.workType,
      kycStatus: p.borrower.kycStatus,
      applicationStatus: p.borrower.applicationStatus,
      sources: Object.fromEntries(p.spec.sources.map((s) => [s.id, { status: s.status, connectedAt: s.connectedAt }])),
    };
  }
  const shares: Share[] = PERSONAS.map((p, i) => {
    const lender = LENDERS[i % 2];
    const createdAt = `${p.appliedAt}T09:00:00.000Z`;
    return {
      id: `share-${p.borrower.id}`,
      borrowerId: p.borrower.id,
      lenderId: lender.id,
      lenderName: lender.name,
      code: shareCode(p.borrower.id),
      scope: ["Score & band", "Verified income", "Reasons", "Fraud checks", "Transactions"],
      createdAt,
      expiresAt: `${addDays(p.appliedAt, 30)}T09:00:00.000Z`,
      status: "active",
    };
  });
  return { version: DB_VERSION, borrowers, shares, failRate: 0 };
}

export function shareCode(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `TL-${h.toString(36).toUpperCase().slice(0, 4).padEnd(4, "X")}-${(h % 9000) + 1000}`;
}

let db: DemoDb | null = null;

export function getDb(): DemoDb {
  if (db) return db;
  db = seedDb();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDb;
        if (parsed.version === DB_VERSION) db = parsed;
      }
    } catch {
      // Storage unavailable (private mode): keep the in-memory seed.
    }
  }
  return db;
}

export function saveDb(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

export function resetDb(): void {
  db = seedDb();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** Apply stored status to a persona's source catalogue. */
export function sourcesFor(borrowerId: string, catalogue: DataSource[]): DataSource[] {
  const state = getDb().borrowers[borrowerId];
  return catalogue.map((s) => {
    const st = state?.sources[s.id];
    return st ? { ...s, status: st.status, connectedAt: st.connectedAt } : s;
  });
}

/** Consents derived from connected sources and lender shares. */
export function consentsFor(borrowerId: string, sources: DataSource[]): Consent[] {
  const sourceConsents: Consent[] = sources
    .filter((s) => s.connectedAt && (s.status === "connected" || s.status === "revoked"))
    .map((s) => ({
      id: `consent-${s.id}`,
      kind: "source",
      targetId: s.id,
      scope: s.dataShared,
      grantedAt: s.connectedAt as string,
      expiresAt: `${addDays((s.connectedAt as string).slice(0, 10), s.consentDays)}T00:00:00.000Z`,
      status: s.status === "connected" ? "active" : "revoked",
    }));
  const shareConsents: Consent[] = getDb()
    .shares.filter((sh) => sh.borrowerId === borrowerId)
    .map((sh) => ({
      id: `consent-${sh.id}`,
      kind: "lender_share",
      targetId: sh.lenderId,
      scope: sh.scope,
      grantedAt: sh.createdAt,
      expiresAt: sh.expiresAt,
      status: sh.status,
    }));
  return [...sourceConsents, ...shareConsents];
}

export const NOW_ISO = () => `${DEMO_AS_OF}T${new Date().toISOString().slice(11)}`;
