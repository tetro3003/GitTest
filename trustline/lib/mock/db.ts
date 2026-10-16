import type { EvidenceFeed, Share } from "../types";
import { seedBorrowers, seedShares } from "../service/seed";
import type { AuditEntry, BorrowerState, Store } from "../service/store";

/**
 * Browser implementation of the Store (mock / demo mode): plain objects in
 * memory, persisted to localStorage so a reload keeps the demo state.
 */
interface DemoDb {
  version: number;
  borrowers: Record<string, BorrowerState>;
  shares: Share[];
  feeds: Record<string, EvidenceFeed[]>;
  audit: AuditEntry[];
  /** Probability (0–1) that a mock call fails, to show error states. */
  failRate: number;
}

const STORAGE_KEY = "trustline-demo-db";
const DB_VERSION = 3;
const MAX_AUDIT = 300;

function seed(): DemoDb {
  return { version: DB_VERSION, borrowers: seedBorrowers(), shares: seedShares(new Date()), feeds: {}, audit: [], failRate: 0 };
}

let db: DemoDb | null = null;

function load(): DemoDb {
  if (db) return db;
  db = seed();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as DemoDb) : null;
      if (parsed?.version === DB_VERSION) db = parsed;
    } catch {
      // Storage unavailable (private mode): keep the in-memory seed.
    }
  }
  return db;
}

function save(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded or storage blocked: the demo keeps working in memory.
  }
}

export const localStore: Store = {
  getBorrower: (id) => load().borrowers[id],
  saveBorrower: (id, st) => {
    load().borrowers[id] = st;
    save();
  },
  listShares: (f) => load().shares.filter((s) => (!f?.borrowerId || s.borrowerId === f.borrowerId) && (!f?.lenderId || s.lenderId === f.lenderId)),
  saveShare: (share) => {
    const d = load();
    const i = d.shares.findIndex((s) => s.id === share.id);
    if (i >= 0) d.shares[i] = share;
    else d.shares.unshift(share);
    save();
  },
  getFeeds: (id) => load().feeds[id] ?? [],
  saveFeed: (id, feed) => {
    const d = load();
    d.feeds[id] = [...(d.feeds[id] ?? []).filter((f) => f.sourceId !== feed.sourceId), feed];
    save();
  },
  deleteFeed: (id, sourceId) => {
    const d = load();
    d.feeds[id] = (d.feeds[id] ?? []).filter((f) => f.sourceId !== sourceId);
    save();
  },
  audit: (e) => {
    const d = load();
    d.audit = [e, ...d.audit].slice(0, MAX_AUDIT);
    save();
  },
  listAudit: (f) =>
    load()
      .audit.filter((e) => (!f?.borrowerId || e.borrowerId === f.borrowerId) && (!f?.actor || e.actor === f.actor))
      .slice(0, f?.limit ?? 100),
  reset: () => {
    db = seed();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
};

export function getFailRate(): number {
  return load().failRate;
}

export function setFailRate(rate: number): void {
  load().failRate = rate;
  save();
}
