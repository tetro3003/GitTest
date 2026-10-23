import type Database from "better-sqlite3";
import type { AuditEvent, BetaConnection, BetaScore, BetaUser, ConnectionStatus, IdentityCheck, LenderDecision, LenderShare, PaymentFact, UserRole, ProviderId, TimelineActor, TimelineEntry, TimelineLevel, WorkFact } from "@/lib/beta/types";
import { newId, newToken, sha256 } from "./auth";
import { migrateBeta } from "./schema";

export const SESSION_DAYS = 14;

interface ConnectionRow {
  id: string;
  user_id: string;
  provider: ProviderId;
  label: string;
  status: ConnectionStatus;
  secret: string | null;
  settings: string;
  created_at: string;
  last_sync_at: string | null;
  last_error: string | null;
}

/** A connection as the server sees it, including the sealed secret. */
export interface StoredConnection extends Omit<BetaConnection, "stats"> {
  userId: string;
  secret: string | null;
}

export type NewWork = WorkFact & { extId: string };
export type NewPayment = PaymentFact & { extId: string };

const now = () => new Date().toISOString();

export function createBetaStore(db: Database.Database) {
  migrateBeta(db);

  const toConn = (r: ConnectionRow): StoredConnection => ({
    id: r.id,
    userId: r.user_id,
    provider: r.provider,
    label: r.label,
    status: r.status,
    secret: r.secret,
    settings: JSON.parse(r.settings) as Record<string, unknown>,
    createdAt: r.created_at,
    lastSyncAt: r.last_sync_at,
    lastError: r.last_error,
  });

  const store = {
    /* ----- users & sessions ----- */
    createUser(u: { email: string; name: string; passwordHash: string; role?: UserRole; org?: string | null }): BetaUser {
      const user: BetaUser = { id: newId("usr"), email: u.email.toLowerCase(), name: u.name, createdAt: now(), role: u.role ?? "freelancer", org: u.org ?? null };
      db.prepare("INSERT INTO beta_users (id, email, name, password_hash, created_at, role, org) VALUES (?, ?, ?, ?, ?, ?, ?)").run(user.id, user.email, user.name, u.passwordHash, user.createdAt, user.role, user.org);
      return user;
    },
    userByEmail(email: string): (BetaUser & { passwordHash: string }) | null {
      const r = db.prepare("SELECT id, email, name, password_hash AS passwordHash, created_at AS createdAt, role, org FROM beta_users WHERE email = ?").get(email.toLowerCase()) as (BetaUser & { passwordHash: string }) | undefined;
      return r ?? null;
    },
    user(id: string): BetaUser | null {
      return (db.prepare("SELECT id, email, name, created_at AS createdAt, role, org FROM beta_users WHERE id = ?").get(id) as BetaUser | undefined) ?? null;
    },
    lenders(): { id: string; org: string }[] {
      return db.prepare("SELECT id, COALESCE(org, name) AS org FROM beta_users WHERE role = 'lender' ORDER BY org").all() as { id: string; org: string }[];
    },

    /* ----- sharing with lenders, decisions, audit ----- */
    createShare(userId: string, lenderId: string): string {
      const id = newId("shr");
      db.prepare("INSERT INTO beta_shares (id, user_id, lender_id, created_at) VALUES (?, ?, ?, ?)").run(id, userId, lenderId, now());
      return id;
    },
    revokeShare(userId: string, shareId: string): { lenderId: string } | null {
      const r = db.prepare("SELECT lender_id FROM beta_shares WHERE id = ? AND user_id = ? AND revoked_at IS NULL").get(shareId, userId) as { lender_id: string } | undefined;
      if (!r) return null;
      db.prepare("UPDATE beta_shares SET revoked_at = ? WHERE id = ?").run(now(), shareId);
      return { lenderId: r.lender_id };
    },
    sharesOf(userId: string): LenderShare[] {
      return db
        .prepare("SELECT s.id, s.lender_id AS lenderId, COALESCE(u.org, u.name) AS lenderOrg, s.created_at AS createdAt, s.revoked_at AS revokedAt FROM beta_shares s JOIN beta_users u ON u.id = s.lender_id WHERE s.user_id = ? ORDER BY s.created_at DESC")
        .all(userId) as LenderShare[];
    },
    activeShare(userId: string, lenderId: string): { id: string; createdAt: string } | null {
      return (db.prepare("SELECT id, created_at AS createdAt FROM beta_shares WHERE user_id = ? AND lender_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1").get(userId, lenderId) as { id: string; createdAt: string } | undefined) ?? null;
    },
    applicantsOf(lenderId: string): { userId: string; name: string; email: string; sharedAt: string }[] {
      return db
        .prepare("SELECT s.user_id AS userId, u.name, u.email, MAX(s.created_at) AS sharedAt FROM beta_shares s JOIN beta_users u ON u.id = s.user_id WHERE s.lender_id = ? AND s.revoked_at IS NULL GROUP BY s.user_id ORDER BY sharedAt DESC")
        .all(lenderId) as { userId: string; name: string; email: string; sharedAt: string }[];
    },
    addDecision(d: Omit<LenderDecision, "id" | "createdAt" | "lenderOrg">): string {
      const id = newId("dec");
      db.prepare("INSERT INTO beta_decisions (id, user_id, lender_id, officer, decision, amount_usd, note, recommendation, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, d.applicantId, d.lenderId, d.officer, d.decision, d.amountUsd, d.note, d.recommendation, d.score, now());
      return id;
    },
    decisions(where: { userId?: string; lenderId?: string }): LenderDecision[] {
      const cond = [where.userId ? "d.user_id = @userId" : null, where.lenderId ? "d.lender_id = @lenderId" : null].filter(Boolean).join(" AND ") || "1";
      return db
        .prepare(`SELECT d.id, d.user_id AS applicantId, d.lender_id AS lenderId, COALESCE(u.org, u.name) AS lenderOrg, d.officer, d.decision, d.amount_usd AS amountUsd, d.note, d.recommendation, d.score, d.created_at AS createdAt FROM beta_decisions d JOIN beta_users u ON u.id = d.lender_id WHERE ${cond} ORDER BY d.created_at DESC`)
        .all({ userId: where.userId, lenderId: where.lenderId }) as LenderDecision[];
    },
    audit(e: { userId: string; lenderId: string | null; actor: string; action: string; detail?: string | null }) {
      db.prepare("INSERT INTO beta_audit (user_id, lender_id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?, ?)").run(e.userId, e.lenderId, now(), e.actor, e.action, e.detail ?? null);
    },
    auditTrail(userId: string, lenderId?: string): AuditEvent[] {
      return db
        .prepare(`SELECT id, at, actor, action, detail FROM beta_audit WHERE user_id = ? ${lenderId ? "AND (lender_id = ? OR lender_id IS NULL)" : ""} ORDER BY id DESC LIMIT 100`)
        .all(...(lenderId ? [userId, lenderId] : [userId])) as AuditEvent[];
    },
    createSession(userId: string): string {
      const token = newToken();
      const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
      db.prepare("INSERT INTO beta_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), userId, expires);
      return token;
    },
    userForSession(token: string): BetaUser | null {
      const r = db.prepare("SELECT user_id, expires_at FROM beta_sessions WHERE token_hash = ?").get(sha256(token)) as { user_id: string; expires_at: string } | undefined;
      if (!r || r.expires_at < now()) return null;
      return store.user(r.user_id);
    },
    deleteSession(token: string) {
      db.prepare("DELETE FROM beta_sessions WHERE token_hash = ?").run(sha256(token));
    },

    /* ----- connections ----- */
    connections(userId: string): BetaConnection[] {
      const rows = db.prepare("SELECT * FROM beta_connections WHERE user_id = ? ORDER BY created_at").all(userId) as ConnectionRow[];
      const work = db.prepare("SELECT connection_id AS id, COUNT(*) AS n FROM beta_work WHERE user_id = ? GROUP BY connection_id").all(userId) as { id: string; n: number }[];
      const pay = db.prepare("SELECT connection_id AS id, COUNT(*) AS n FROM beta_payments WHERE user_id = ? AND status = 'income' GROUP BY connection_id").all(userId) as { id: string; n: number }[];
      return rows.map((r) => {
        const c = toConn(r);
        return { id: c.id, provider: c.provider, label: c.label, status: c.status, createdAt: c.createdAt, lastSyncAt: c.lastSyncAt, lastError: c.lastError, settings: c.settings, stats: { workItems: work.find((w) => w.id === r.id)?.n ?? 0, payments: pay.find((p) => p.id === r.id)?.n ?? 0 } };
      });
    },
    connection(userId: string, id: string): StoredConnection | null {
      const r = db.prepare("SELECT * FROM beta_connections WHERE id = ? AND user_id = ?").get(id, userId) as ConnectionRow | undefined;
      return r ? toConn(r) : null;
    },
    connectionById(id: string): StoredConnection | null {
      const r = db.prepare("SELECT * FROM beta_connections WHERE id = ?").get(id) as ConnectionRow | undefined;
      return r ? toConn(r) : null;
    },
    createConnection(c: { userId: string; provider: ProviderId; label: string; status: ConnectionStatus; secret: string | null; settings: Record<string, unknown> }): StoredConnection {
      const id = newId("con");
      db.prepare("INSERT INTO beta_connections (id, user_id, provider, label, status, secret, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, c.userId, c.provider, c.label, c.status, c.secret, JSON.stringify(c.settings), now());
      return store.connectionById(id)!;
    },
    updateConnection(id: string, patch: Partial<{ label: string; status: ConnectionStatus; secret: string | null; settings: Record<string, unknown>; lastSyncAt: string; lastError: string | null }>) {
      const cols: [string, unknown][] = [];
      if (patch.label !== undefined) cols.push(["label", patch.label]);
      if (patch.status !== undefined) cols.push(["status", patch.status]);
      if (patch.secret !== undefined) cols.push(["secret", patch.secret]);
      if (patch.settings !== undefined) cols.push(["settings", JSON.stringify(patch.settings)]);
      if (patch.lastSyncAt !== undefined) cols.push(["last_sync_at", patch.lastSyncAt]);
      if (patch.lastError !== undefined) cols.push(["last_error", patch.lastError]);
      if (!cols.length) return;
      db.prepare(`UPDATE beta_connections SET ${cols.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map(([, v]) => v), id);
    },
    deleteConnection(id: string) {
      db.prepare("DELETE FROM beta_connections WHERE id = ?").run(id);
    },
    /** Connections the daily robot should refresh: ready and not synced since `cutoff`. */
    connectionsDue(cutoff: string): StoredConnection[] {
      const rows = db.prepare("SELECT * FROM beta_connections WHERE status IN ('ok', 'error') AND provider NOT IN ('bank', 'bank_id') AND (last_sync_at IS NULL OR last_sync_at < ?)").all(cutoff) as ConnectionRow[];
      return rows.map(toConn);
    },

    /* ----- one-time states ----- */
    /** `provider` is a ProviderId or an OAuth provider name; `verifier` is the PKCE secret when used. */
    saveOAuthState(state: string, userId: string, provider: string, verifier: string | null = null) {
      db.prepare("INSERT INTO beta_oauth_states (state, user_id, provider, created_at, verifier) VALUES (?, ?, ?, ?, ?)").run(state, userId, provider, now(), verifier);
    },
    takeOAuthState(state: string): { userId: string; provider: string; verifier: string | null } | null {
      const r = db.prepare("SELECT user_id, provider, created_at, verifier FROM beta_oauth_states WHERE state = ?").get(state) as { user_id: string; provider: string; created_at: string; verifier: string | null } | undefined;
      db.prepare("DELETE FROM beta_oauth_states WHERE state = ?").run(state);
      if (!r || Date.now() - new Date(r.created_at).getTime() > 15 * 60_000) return null;
      return { userId: r.user_id, provider: r.provider, verifier: r.verifier };
    },
    saveChallenge(c: { id: string; userId: string; family: string; address: string; message: string; expiresAt: string }) {
      db.prepare("INSERT INTO beta_wallet_challenges (id, user_id, family, address, message, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(c.id, c.userId, c.family, c.address, c.message, c.expiresAt);
    },
    takeChallenge(id: string, userId: string, at = now()): { family: string; address: string; message: string } | null {
      const r = db.prepare("SELECT family, address, message, expires_at FROM beta_wallet_challenges WHERE id = ? AND user_id = ?").get(id, userId) as { family: string; address: string; message: string; expires_at: string } | undefined;
      db.prepare("DELETE FROM beta_wallet_challenges WHERE id = ?").run(id);
      if (!r || r.expires_at < at) return null;
      return r;
    },

    /* ----- facts ----- */
    /** Inserts facts that aren't stored yet; returns how many were new. */
    addWork(userId: string, connectionId: string, facts: readonly NewWork[]): number {
      const ins = db.prepare("INSERT OR IGNORE INTO beta_work (user_id, connection_id, ext_id, at, kind, item, person, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      return db.transaction(() => facts.reduce((n, f) => n + ins.run(userId, connectionId, f.extId, f.at, f.kind, f.item, f.person, f.source).changes, 0))();
    },
    addPayments(userId: string, connectionId: string, facts: readonly NewPayment[]): number {
      const ins = db.prepare("INSERT OR IGNORE INTO beta_payments (user_id, connection_id, ext_id, at, amount_usd, asset, chain, payer, payer_label, status, note, proof, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      return db.transaction(() => facts.reduce((n, f) => n + ins.run(userId, connectionId, f.extId, f.at, f.amountUsd, f.asset, f.chain, f.payer, f.payerLabel, f.status, f.note, f.proof, f.source).changes, 0))();
    },
    deletePayments(connectionId: string) {
      db.prepare("DELETE FROM beta_payments WHERE connection_id = ?").run(connectionId);
    },
    work(userId: string): WorkFact[] {
      return db.prepare("SELECT at, source, kind, item, person FROM beta_work WHERE user_id = ? ORDER BY at").all(userId) as WorkFact[];
    },
    payments(userId: string): (PaymentFact & { connectionId: string })[] {
      return db.prepare("SELECT at, source, amount_usd AS amountUsd, asset, chain, payer, payer_label AS payerLabel, status, note, proof, connection_id AS connectionId FROM beta_payments WHERE user_id = ? ORDER BY at DESC").all(userId) as (PaymentFact & { connectionId: string })[];
    },

    /* ----- identity ----- */
    saveIdentity(userId: string, check: IdentityCheck) {
      db.prepare("INSERT INTO beta_identity (user_id, status, report, verified_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, report = excluded.report, verified_at = excluded.verified_at").run(userId, check.status, JSON.stringify(check), check.verifiedAt);
    },
    identity(userId: string): IdentityCheck | null {
      const r = db.prepare("SELECT report FROM beta_identity WHERE user_id = ?").get(userId) as { report: string } | undefined;
      return r ? (JSON.parse(r.report) as IdentityCheck) : null;
    },

    /* ----- timeline ----- */
    log(e: Omit<TimelineEntry, "id" | "at"> & { userId: string }) {
      db.prepare("INSERT INTO beta_timeline (user_id, at, run_id, connection_id, actor, level, text, tech) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(e.userId, now(), e.runId, e.connectionId, e.actor, e.level, e.text, e.tech);
    },
    timeline(userId: string, afterId = 0, limit = 200): TimelineEntry[] {
      const rows = db
        .prepare("SELECT id, at, run_id AS runId, connection_id AS connectionId, actor, level, text, tech FROM beta_timeline WHERE user_id = ? AND id > ? ORDER BY id DESC LIMIT ?")
        .all(userId, afterId, limit) as TimelineEntry[];
      return rows.reverse();
    },

    /* ----- scores ----- */
    saveScore(userId: string, report: BetaScore) {
      db.prepare("INSERT INTO beta_scores (user_id, at, score, report) VALUES (?, ?, ?, ?)").run(userId, report.generatedAt, report.score, JSON.stringify(report));
    },
    latestScore(userId: string): BetaScore | null {
      const r = db.prepare("SELECT report FROM beta_scores WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId) as { report: string } | undefined;
      return r ? (JSON.parse(r.report) as BetaScore) : null;
    },
    scoreHistory(userId: string): { at: string; score: number | null }[] {
      return db.prepare("SELECT at, score FROM beta_scores WHERE user_id = ? ORDER BY id DESC LIMIT 60").all(userId) as { at: string; score: number | null }[];
    },
  };
  return store;
}

export type BetaStore = ReturnType<typeof createBetaStore>;

/** A run groups the timeline steps of one action (a connect, a sync, a robot pass). */
export function startRun(store: BetaStore, userId: string, connectionId: string | null) {
  const runId = newId("run");
  const put = (level: TimelineLevel) => (actor: TimelineActor, text: string, tech: string | null = null) => store.log({ userId, runId, connectionId, actor, level, text, tech });
  return { runId, step: put("step"), ok: put("ok"), warn: put("warn"), error: put("error") };
}
export type Run = ReturnType<typeof startRun>;
