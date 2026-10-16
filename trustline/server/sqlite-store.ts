import type Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { seedBorrowers, seedShares } from "@/lib/service/seed";
import type { AuditEntry, BorrowerState, Store } from "@/lib/service/store";
import type { EvidenceFeed, Share, WorkEvent } from "@/lib/types";

/** The demo lender key, so the dashboard and the API docs work out of the box. */
export const DEMO_LENDER_KEY = process.env.TRUSTLINE_DEMO_LENDER_KEY ?? "tl_demo_citybank_key";

export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

interface BorrowerRow {
  id: string;
  name: string;
  phone: string;
  work_type: string;
  kyc_status: string;
  application_status: string;
}

/** SQLite implementation of the Store, plus server-only tables (API keys, ingest keys). */
export function createSqliteStore(db: Database.Database) {
  const q = {
    borrower: db.prepare<[string], BorrowerRow>("SELECT * FROM borrowers WHERE id = ?"),
    sources: db.prepare<[string], { source_id: string; status: string; connected_at: string | null }>("SELECT source_id, status, connected_at FROM source_states WHERE borrower_id = ?"),
    custom: db.prepare<[string], { id: string; name: string; created_at: string }>("SELECT id, name, created_at FROM custom_sources WHERE borrower_id = ? ORDER BY created_at"),
    items: db.prepare<[string], { item_id: string; shared: number }>("SELECT item_id, shared FROM work_item_choices WHERE borrower_id = ?"),
    recordings: db.prepare<[string], { id: string; source_id: string; name: string; recorded_minutes: number; speech_minutes: number; shared: number; created_at: string }>(
      "SELECT * FROM lesson_recordings WHERE borrower_id = ? ORDER BY created_at",
    ),
    upsertBorrower: db.prepare(
      `INSERT INTO borrowers (id, name, phone, work_type, kyc_status, application_status, updated_at) VALUES (@id, @name, @phone, @work_type, @kyc_status, @application_status, @updated_at)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, work_type = excluded.work_type, kyc_status = excluded.kyc_status, application_status = excluded.application_status, updated_at = excluded.updated_at`,
    ),
    feeds: db.prepare<[string], { source_id: string; channel: string; label: string; updated_at: string }>("SELECT source_id, channel, label, updated_at FROM evidence_feeds WHERE borrower_id = ?"),
    events: db.prepare<[string, string], { at: string; minutes: number; kind: string; units: number | null; client: string | null; amount: number | null; km: number | null; item: string | null }>(
      "SELECT at, minutes, kind, units, client, amount, km, item FROM work_events WHERE borrower_id = ? AND source_id = ? ORDER BY at",
    ),
    shares: db.prepare<[], { id: string; borrower_id: string; lender_id: string; lender_name: string; code: string; scope: string; created_at: string; expires_at: string; status: string }>(
      "SELECT * FROM shares ORDER BY created_at DESC",
    ),
  };

  const toShare = (r: ReturnType<typeof q.shares.all>[number]): Share => ({
    id: r.id,
    borrowerId: r.borrower_id,
    lenderId: r.lender_id,
    lenderName: r.lender_name,
    code: r.code,
    scope: JSON.parse(r.scope) as string[],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    status: r.status as Share["status"],
  });

  const saveBorrower = db.transaction((id: string, st: BorrowerState) => {
    q.upsertBorrower.run({ id, name: st.name, phone: st.phone, work_type: st.workType, kyc_status: st.kycStatus, application_status: st.applicationStatus, updated_at: new Date().toISOString() });
    db.prepare("DELETE FROM source_states WHERE borrower_id = ?").run(id);
    const ins = db.prepare("INSERT INTO source_states (borrower_id, source_id, status, connected_at) VALUES (?, ?, ?, ?)");
    for (const [sid, v] of Object.entries(st.sources)) ins.run(id, sid, v.status, v.connectedAt);
    db.prepare("DELETE FROM work_item_choices WHERE borrower_id = ?").run(id);
    const insItem = db.prepare("INSERT INTO work_item_choices (borrower_id, item_id, shared) VALUES (?, ?, ?)");
    for (const [iid, shared] of Object.entries(st.items)) insItem.run(id, iid, shared ? 1 : 0);
    db.prepare("DELETE FROM lesson_recordings WHERE borrower_id = ?").run(id);
    const insRec = db.prepare("INSERT INTO lesson_recordings (id, borrower_id, source_id, name, recorded_minutes, speech_minutes, shared, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const u of st.uploads) insRec.run(u.id, id, u.sourceId, u.name, u.stats.recordedMinutes ?? 0, u.stats.speechMinutes ?? 0, u.shared ? 1 : 0, `${u.lastActivity}T00:00:00.000Z`);
    db.prepare("DELETE FROM custom_sources WHERE borrower_id = ?").run(id);
    const insCustom = db.prepare("INSERT INTO custom_sources (id, borrower_id, name, created_at) VALUES (?, ?, ?, ?)");
    for (const c of st.customSources) insCustom.run(c.id, id, c.name, c.createdAt);
  });

  const saveFeed = db.transaction((id: string, feed: EvidenceFeed) => {
    db.prepare("DELETE FROM evidence_feeds WHERE borrower_id = ? AND source_id = ?").run(id, feed.sourceId);
    db.prepare("INSERT INTO evidence_feeds (borrower_id, source_id, channel, label, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, feed.sourceId, feed.channel, feed.label, feed.updatedAt);
    const ins = db.prepare("INSERT INTO work_events (borrower_id, source_id, at, minutes, kind, units, client, amount, km, item) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const e of feed.events) ins.run(id, feed.sourceId, e.at, e.minutes, e.kind, e.units ?? null, e.client ?? null, e.amount ?? null, e.km ?? null, e.item ?? null);
  });

  const seed = db.transaction(() => {
    for (const [id, st] of Object.entries(seedBorrowers())) saveBorrower(id, st);
    const insShare = db.prepare("INSERT INTO shares (id, borrower_id, lender_id, lender_name, code, scope, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const s of seedShares(new Date())) insShare.run(s.id, s.borrowerId, s.lenderId, s.lenderName, s.code, JSON.stringify(s.scope), s.createdAt, s.expiresAt, s.status);
    db.prepare("INSERT OR IGNORE INTO api_keys (key_hash, lender_id, label, created_at) VALUES (?, 'city-bank', 'Demo key', ?)").run(hashKey(DEMO_LENDER_KEY), new Date().toISOString());
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_at', ?)").run(new Date().toISOString());
  });

  const wipe = db.transaction(() => {
    for (const t of ["work_events", "evidence_feeds", "ingest_keys", "shares", "lesson_recordings", "work_item_choices", "custom_sources", "source_states", "borrowers", "audit_log"]) db.prepare(`DELETE FROM ${t}`).run();
  });

  if (!db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get()) seed();

  const store: Store = {
    getBorrower(id) {
      const b = q.borrower.get(id);
      if (!b) return undefined;
      return {
        name: b.name,
        phone: b.phone,
        workType: b.work_type as BorrowerState["workType"],
        kycStatus: b.kyc_status as BorrowerState["kycStatus"],
        applicationStatus: b.application_status as BorrowerState["applicationStatus"],
        sources: Object.fromEntries(q.sources.all(id).map((r) => [r.source_id, { status: r.status as BorrowerState["sources"][string]["status"], connectedAt: r.connected_at }])),
        items: Object.fromEntries(q.items.all(id).map((r) => [r.item_id, r.shared === 1])),
        uploads: q.recordings.all(id).map((r) => ({
          id: r.id,
          sourceId: r.source_id,
          name: r.name,
          weight: 0,
          shared: r.shared === 1,
          lastActivity: r.created_at.slice(0, 10),
          stats: { recordedMinutes: r.recorded_minutes, speechMinutes: r.speech_minutes, hours: Math.round((r.speech_minutes / 60) * 10) / 10 },
        })),
        customSources: q.custom.all(id).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })),
      };
    },
    saveBorrower: (id, st) => saveBorrower(id, st),
    listShares: (f) => q.shares.all().map(toShare).filter((s) => (!f?.borrowerId || s.borrowerId === f.borrowerId) && (!f?.lenderId || s.lenderId === f.lenderId)),
    saveShare: (s) =>
      void db
        .prepare(
          `INSERT INTO shares (id, borrower_id, lender_id, lender_name, code, scope, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status, expires_at = excluded.expires_at, scope = excluded.scope`,
        )
        .run(s.id, s.borrowerId, s.lenderId, s.lenderName, s.code, JSON.stringify(s.scope), s.createdAt, s.expiresAt, s.status),
    getFeeds: (id) =>
      q.feeds.all(id).map((f) => ({
        sourceId: f.source_id,
        channel: f.channel as EvidenceFeed["channel"],
        label: f.label,
        updatedAt: f.updated_at,
        events: q.events.all(id, f.source_id).map(
          (e): WorkEvent => ({
            at: e.at,
            minutes: e.minutes,
            kind: e.kind as WorkEvent["kind"],
            ...(e.units !== null ? { units: e.units } : {}),
            ...(e.client !== null ? { client: e.client } : {}),
            ...(e.amount !== null ? { amount: e.amount } : {}),
            ...(e.km !== null ? { km: e.km } : {}),
            ...(e.item !== null ? { item: e.item } : {}),
          }),
        ),
      })),
    saveFeed: (id, feed) => saveFeed(id, feed),
    deleteFeed: (id, sid) => void db.prepare("DELETE FROM evidence_feeds WHERE borrower_id = ? AND source_id = ?").run(id, sid),
    audit: (e: AuditEntry) => void db.prepare("INSERT INTO audit_log (at, actor, action, borrower_id, detail) VALUES (?, ?, ?, ?, ?)").run(e.at, e.actor, e.action, e.borrowerId ?? null, e.detail ?? null),
    listAudit: (f) => {
      const rows = db
        .prepare<[string | null, string | null, string | null, string | null, number], { at: string; actor: string; action: string; borrower_id: string | null; detail: string | null }>(
          "SELECT at, actor, action, borrower_id, detail FROM audit_log WHERE (? IS NULL OR borrower_id = ?) AND (? IS NULL OR actor = ?) ORDER BY id DESC LIMIT ?",
        )
        .all(f?.borrowerId ?? null, f?.borrowerId ?? null, f?.actor ?? null, f?.actor ?? null, f?.limit ?? 100);
      return rows.map((r) => ({ at: r.at, actor: r.actor, action: r.action, ...(r.borrower_id ? { borrowerId: r.borrower_id } : {}), ...(r.detail ? { detail: r.detail } : {}) }));
    },
    reset: () => {
      wipe();
      seed();
    },
  };

  return {
    store,
    /** Lender id for an API key, or null. */
    lenderForKey: (key: string): string | null =>
      db.prepare<[string], { lender_id: string }>("SELECT lender_id FROM api_keys WHERE key_hash = ?").get(hashKey(key))?.lender_id ?? null,
    /** One ingest key per (borrower, source); created on first request. */
    ingestKeyFor(borrowerId: string, sourceId: string): string {
      const row = db.prepare<[string, string], { key: string }>("SELECT key FROM ingest_keys WHERE borrower_id = ? AND source_id = ?").get(borrowerId, sourceId);
      if (row) return row.key;
      const key = `tl_ing_${randomBytes(18).toString("base64url")}`;
      db.prepare("INSERT INTO ingest_keys (key, borrower_id, source_id, created_at) VALUES (?, ?, ?, ?)").run(key, borrowerId, sourceId, new Date().toISOString());
      return key;
    },
    resolveIngestKey: (key: string) => db.prepare<[string], { borrower_id: string; source_id: string }>("SELECT borrower_id, source_id FROM ingest_keys WHERE key = ?").get(key) ?? null,
  };
}

export type SqliteStore = ReturnType<typeof createSqliteStore>;
