import { ApiError } from "../api/client";
import type { ConnectCredentials, LessonRecordingSample, WorkDataImport } from "../api/client";
import { DEMO_AS_OF } from "../config";
import { addDays } from "../dates";
import { eventRange } from "../evidence/aggregate";
import { importWorkExport, type ImportResult } from "../evidence/importer";
import { buildScoringInput, sourceCatalogue } from "../mock/dataset";
import { getPersona, PERSONAS, type PersonaDefinition } from "../mock/personas";
import { isActivitySource } from "../mock/sources";
import { computeScoreReport } from "../scoring";
import { weeklyTotals } from "../scoring/activity";
import type {
  ApplicantDetail,
  ApplicantQuery,
  ApplicantSummary,
  Borrower,
  BorrowerProfile,
  Consent,
  DataSource,
  EvidenceFeed,
  Lender,
  MonitoringAlert,
  PersonaSummary,
  ScoreReport,
  ScoringInput,
  Severity,
  Share,
  WorkEvent,
  WorkItem,
  WorkType,
} from "../types";
import { LENDERS, shareCode } from "./seed";
import type { BorrowerState, Store } from "./store";

/**
 * The Trustline service: every operation the app supports, written once and
 * backed by a Store. The browser demo (mock mode) and the real server (SQLite)
 * both run this exact code, so they always behave the same.
 */
export interface ServiceOptions {
  now?: () => Date;
}

/** Fetches real work data for API-based connections (server only). */
export type RealConnector = (input: { borrowerId: string; source: DataSource; credentials: ConnectCredentials }) => Promise<{ label: string; events: WorkEvent[] }>;

const SEV_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
const MAX_FEED_EVENTS = 20_000;

export function createTrustlineService(store: Store, opts: ServiceOptions = {}) {
  const now = () => (opts.now ? opts.now() : new Date());
  const nowIso = () => now().toISOString();
  const reportCache = new Map<string, ScoreReport>();

  /* ---------------- helpers ---------------- */

  function persona(id: string): PersonaDefinition {
    const p = getPersona(id);
    if (!p) throw new ApiError(`Borrower ${id} not found`, 404);
    return p;
  }

  function state(id: string): BorrowerState {
    persona(id);
    const st = store.getBorrower(id);
    if (!st) throw new ApiError(`Borrower ${id} not found`, 404);
    return st;
  }

  function sources(id: string): DataSource[] {
    const st = state(id);
    const feeds = new Map(store.getFeeds(id).map((f) => [f.sourceId, f]));
    return sourceCatalogue(id, st.workType, st.customSources).map((s) => {
      const saved = st.sources[s.id];
      const feed = feeds.get(s.id);
      const out: DataSource = saved ? { ...s, status: saved.status, connectedAt: saved.connectedAt } : { ...s, status: "available", connectedAt: null };
      if (feed) out.evidence = { channel: feed.channel, label: feed.label, events: feed.events.length, ...eventRange(feed.events), updatedAt: feed.updatedAt };
      return out;
    });
  }

  function shareStatus(s: Share): Share {
    return s.status === "active" && s.expiresAt < nowIso() ? { ...s, status: "expired" } : s;
  }

  function consents(id: string, srcs: DataSource[]): Consent[] {
    const sourceConsents: Consent[] = srcs
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
    const shareConsents: Consent[] = store.listShares({ borrowerId: id }).map(shareStatus).map((sh) => ({
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

  function borrower(id: string): Borrower {
    const p = persona(id);
    const st = state(id);
    const srcs = sources(id);
    return { ...p.borrower, name: st.name, phone: st.phone, workType: st.workType, kycStatus: st.kycStatus, applicationStatus: st.applicationStatus, connectedSources: srcs, consents: consents(id, srcs) };
  }

  function input(id: string): ScoringInput {
    const p = persona(id);
    const st = state(id);
    const def = { ...p, borrower: { ...p.borrower, workType: st.workType } };
    return buildScoringInput(def, sources(id), DEMO_AS_OF, st.items, st.uploads, store.getFeeds(id));
  }

  function report(id: string): ScoreReport {
    const st = state(id);
    const feeds = store.getFeeds(id).map((f) => `${f.sourceId}:${f.updatedAt}:${f.events.length}`);
    const key = JSON.stringify([id, st.workType, Object.entries(st.sources).filter(([, v]) => v.status === "connected").map(([k]) => k).sort(), st.items, st.uploads.map((u) => `${u.id}:${u.shared}`), st.customSources.map((c) => c.id), feeds]);
    const hit = reportCache.get(key);
    if (hit) return hit;
    const r = computeScoreReport(input(id), `${DEMO_AS_OF}T08:00:00.000Z`);
    reportCache.set(key, r);
    return r;
  }

  function mutate(id: string, fn: (st: BorrowerState) => void, action: string, detail?: string) {
    const st = structuredClone(state(id));
    fn(st);
    store.saveBorrower(id, st);
    store.audit({ at: nowIso(), actor: `borrower:${id}`, action, borrowerId: id, detail });
  }

  function source(id: string, sourceId: string): DataSource {
    const s = sources(id).find((x) => x.id === sourceId);
    if (!s) throw new ApiError("Source not found", 404);
    return s;
  }

  function activeShare(lenderId: string, borrowerId: string): Share | undefined {
    return store
      .listShares({ borrowerId, lenderId })
      .map(shareStatus)
      .find((s) => s.status === "active");
  }

  function lender(lenderId: string): Lender {
    const l = LENDERS.find((x) => x.id === lenderId);
    if (!l) throw new ApiError("Lender not found", 404);
    return l;
  }

  function summary(id: string): ApplicantSummary {
    const b = borrower(id);
    const r = report(id);
    const top = r.fraudFlags.reduce<Severity | null>((acc, f) => (!acc || SEV_RANK[f.severity] > SEV_RANK[acc] ? f.severity : acc), null);
    return {
      id,
      name: b.name,
      workType: b.workType,
      city: b.city,
      score: r.score,
      band: r.band,
      verifiedMonthlyIncome: r.verifiedMonthlyIncome,
      recommendedMaxPayment: r.recommendedMaxPayment,
      fraudFlagCount: r.fraudFlags.length,
      highestSeverity: top,
      status: b.applicationStatus,
      decision: r.decision,
      appliedAt: persona(id).appliedAt,
    };
  }

  function detail(id: string, scope?: string[]): ApplicantDetail {
    const inp = input(id);
    const allowed = (s: string) => !scope || scope.includes(s);
    return {
      borrower: borrower(id),
      report: report(id),
      transactions: allowed("Transactions") ? inp.transactions : [],
      activity: allowed("Work activity") ? inp.activity : [],
      invoices: inp.invoices,
      obligations: inp.obligations,
      workItems: allowed("Work activity") ? inp.workItems : [],
    };
  }

  function saveFeed(id: string, sourceId: string, feed: Omit<EvidenceFeed, "sourceId" | "updatedAt">, mode: "replace" | "append") {
    const existing = store.getFeeds(id).find((f) => f.sourceId === sourceId);
    const events = mode === "append" && existing ? [...existing.events, ...feed.events] : feed.events;
    store.saveFeed(id, { ...feed, sourceId, events: events.slice(-MAX_FEED_EVENTS), updatedAt: nowIso() });
    mutate(id, (st) => {
      st.sources[sourceId] = { status: "connected", connectedAt: st.sources[sourceId]?.connectedAt && st.sources[sourceId].status === "connected" ? st.sources[sourceId].connectedAt : nowIso() };
    }, `work_data.${feed.channel}`, `${sourceId}: ${feed.events.length} event(s) from ${feed.label}`);
  }

  /* ---------------- operations ---------------- */

  return {
    health: () => ({ ok: true, time: nowIso() }),

    getBorrower: (id: string) => borrower(id),

    startOnboarding: (id: string, data: { name: string; phone: string }) => {
      mutate(id, (st) => {
        st.name = data.name.trim() || st.name;
        st.phone = data.phone.trim() || st.phone;
        st.kycStatus = "not_started";
        for (const s of Object.values(st.sources)) {
          s.status = "available";
          s.connectedAt = null;
        }
        st.items = {};
        st.uploads = [];
      }, "onboarding.started");
      for (const f of store.getFeeds(id)) store.deleteFeed(id, f.sourceId);
      return borrower(id);
    },

    submitKyc: (id: string) => {
      mutate(id, (st) => void (st.kycStatus = "verified"), "kyc.verified");
      return borrower(id);
    },

    setWorkType: (id: string, workType: WorkType) => {
      mutate(id, (st) => void (st.workType = workType), "profile.work_type", workType);
      return borrower(id);
    },

    listSources: (id: string) => sources(id),

    /** Connect with simulated/consent-only data. Real data arrives via import, webhook, tracker or a RealConnector. */
    connectSource: (id: string, sourceId: string) => {
      source(id, sourceId);
      mutate(id, (st) => void (st.sources[sourceId] = { status: "connected", connectedAt: nowIso() }), "source.connected", sourceId);
      return source(id, sourceId);
    },

    connectWithConnector: async (id: string, sourceId: string, credentials: ConnectCredentials, connector: RealConnector) => {
      const src = source(id, sourceId);
      const { label, events } = await connector({ borrowerId: id, source: src, credentials });
      saveFeed(id, sourceId, { channel: "api", label, events }, "replace");
      return source(id, sourceId);
    },

    disconnectSource: (id: string, sourceId: string) => {
      const src = source(id, sourceId);
      mutate(id, (st) => void (st.sources[sourceId] = { status: src.connectedAt ? "revoked" : "available", connectedAt: src.connectedAt }), "source.revoked", sourceId);
      store.deleteFeed(id, sourceId);
      return source(id, sourceId);
    },

    getProfile: (id: string): BorrowerProfile => {
      const inp = input(id);
      return { borrower: borrower(id), report: report(id), activity: inp.activity, workItems: inp.workItems };
    },

    setWorkItemShared: (id: string, itemId: string, shared: boolean): WorkItem[] => {
      mutate(id, (st) => {
        const upload = st.uploads.find((u) => u.id === itemId);
        if (upload) upload.shared = shared;
        else st.items[itemId] = shared;
      }, shared ? "work_item.shared" : "work_item.hidden", itemId);
      return input(id).workItems;
    },

    uploadLessonRecording: (id: string, sourceId: string, rec: LessonRecordingSample): WorkItem => {
      source(id, sourceId);
      if (!(rec.recordedMinutes > 0) || rec.speechMinutes < 0 || rec.speechMinutes > rec.recordedMinutes) throw new ApiError("Recording numbers are invalid", 400);
      const item: WorkItem = {
        id: `${sourceId}-upload-${now().getTime().toString(36)}`,
        sourceId,
        name: rec.name.slice(0, 80) || "Lesson recording",
        weight: 0,
        shared: true,
        lastActivity: nowIso().slice(0, 10),
        stats: { recordedMinutes: rec.recordedMinutes, speechMinutes: rec.speechMinutes, hours: Math.round((rec.speechMinutes / 60) * 10) / 10 },
      };
      mutate(id, (st) => void st.uploads.push(item), "work_data.recording", `${rec.recordedMinutes} min`);
      return item;
    },

    /** Universal door #1: an export file from any app. */
    importWorkData: (id: string, sourceId: string, file: WorkDataImport): ImportResult => {
      source(id, sourceId);
      if (file.text.length > 8_000_000) throw new ApiError("File is too large (max 8 MB). Export a shorter period.", 413);
      let result: ImportResult;
      try {
        result = importWorkExport(file.name, file.text, state(id).workType);
      } catch (e) {
        throw new ApiError(e instanceof Error ? e.message : "Could not read the file", 400);
      }
      saveFeed(id, sourceId, { channel: "file", label: file.name, events: result.events }, "replace");
      return result;
    },

    /** Universal doors #2 and #3: webhook events (Zapier, Make, sensors) and the desktop tracker. */
    ingestEvents: (id: string, sourceId: string, events: WorkEvent[], channel: "webhook" | "tracker", label: string) => {
      source(id, sourceId);
      saveFeed(id, sourceId, { channel, label, events }, "append");
      return { accepted: events.length };
    },

    /** Add an app that isn't in the list. */
    addCustomWorkApp: (id: string, name: string): DataSource => {
      const clean = name.trim().slice(0, 40);
      if (!clean) throw new ApiError("Give the app a name", 400);
      const sid = `${id}-custom-${now().getTime().toString(36)}`;
      mutate(id, (st) => {
        st.customSources.push({ id: sid, name: clean, createdAt: nowIso() });
        st.sources[sid] = { status: "connected", connectedAt: nowIso() };
      }, "source.custom_added", clean);
      return source(id, sid);
    },

    listLenders: () => LENDERS,

    shareWithLender: (id: string, lenderId: string, o: { days: number; scope: string[] }): Share => {
      const l = lender(lenderId);
      const days = Math.min(365, Math.max(1, Math.round(o.days)));
      const created = nowIso();
      const share: Share = {
        id: `share-${id}-${now().getTime().toString(36)}`,
        borrowerId: id,
        lenderId,
        lenderName: l.name,
        code: shareCode(`${id}${lenderId}${created}`),
        scope: o.scope,
        createdAt: created,
        expiresAt: `${addDays(created.slice(0, 10), days)}T23:59:59.000Z`,
        status: "active",
      };
      state(id);
      store.saveShare(share);
      store.audit({ at: created, actor: `borrower:${id}`, action: "share.created", borrowerId: id, detail: `${l.name}, ${days} days` });
      return share;
    },

    listShares: (id: string) => store.listShares({ borrowerId: id }).map(shareStatus),

    revokeShare: (id: string, shareId: string): Share => {
      const share = store.listShares({ borrowerId: id }).find((s) => s.id === shareId);
      if (!share) throw new ApiError("Share not found", 404);
      const updated = { ...share, status: "revoked" as const };
      store.saveShare(updated);
      store.audit({ at: nowIso(), actor: `borrower:${id}`, action: "share.revoked", borrowerId: id, detail: share.lenderName });
      return updated;
    },

    /* ----- lender side: only applicants with an active share to this lender ----- */

    getApplicants: (lenderId: string, q?: ApplicantQuery): ApplicantSummary[] => {
      lender(lenderId);
      let rows = PERSONAS.map((p) => p.borrower.id)
        .filter((id) => activeShare(lenderId, id))
        .map(summary);
      if (q?.search) {
        const s = q.search.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.city.toLowerCase().includes(s));
      }
      if (q?.bands?.length) rows = rows.filter((r) => q.bands?.includes(r.band));
      if (q?.workTypes?.length) rows = rows.filter((r) => q.workTypes?.includes(r.workType));
      const dir = q?.sortDir === "asc" ? 1 : -1;
      const by = q?.sortBy ?? "appliedAt";
      const val = (r: ApplicantSummary) => (by === "score" ? r.score : by === "income" ? r.verifiedMonthlyIncome : by === "name" ? r.name : r.appliedAt);
      return rows.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
    },

    getApplicant: (lenderId: string, id: string): ApplicantDetail => {
      const share = activeShare(lenderId, id);
      if (!share) throw new ApiError(`${persona(id).borrower.name} hasn't shared their profile with ${lender(lenderId).name}, or revoked it.`, 403);
      store.audit({ at: nowIso(), actor: `lender:${lenderId}`, action: "applicant.viewed", borrowerId: id });
      return detail(id, share.scope);
    },

    /** Lender API: exchange a share code for a report. */
    redeemShareCode: (lenderId: string, code: string) => {
      const share = store.listShares({ lenderId }).map(shareStatus).find((s) => s.code === code.trim().toUpperCase());
      if (!share) throw new ApiError("Unknown share code for this lender", 404);
      if (share.status !== "active") throw new ApiError(`This share was ${share.status}`, 403);
      store.audit({ at: nowIso(), actor: `lender:${lenderId}`, action: "report.redeemed", borrowerId: share.borrowerId, detail: share.code });
      const d = detail(share.borrowerId, share.scope);
      return { reportId: `rpt_${share.borrowerId}_${d.report.generatedAt.slice(0, 10).replace(/-/g, "")}`, share, ...d };
    },

    getMonitoring: (lenderId: string): MonitoringAlert[] => {
      const alerts: MonitoringAlert[] = [];
      for (const p of PERSONAS) {
        const id = p.borrower.id;
        if (!activeShare(lenderId, id)) continue;
        const r = report(id);
        const trend = weeklyTotals(input(id).activity)
          .slice(-12)
          .map((w) => w.hours);
        const base = { borrowerId: id, borrowerName: state(id).name, workType: state(id).workType, detectedAt: addDays(DEMO_AS_OF, -1), trend };
        r.earlyWarnings.forEach((w, i) => alerts.push({ ...base, id: `${id}-w${i}`, severity: w.severity, type: w.type, message: w.message }));
        if (r.fraudFlags.length) {
          const top = r.fraudFlags.reduce((a, f) => (SEV_RANK[f.severity] > SEV_RANK[a.severity] ? f : a));
          const message = r.fraudFlags.length === 1 ? top.title : `${r.fraudFlags.length} fraud flags: ${r.fraudFlags.map((f) => f.title.toLowerCase()).join(", ")}`;
          alerts.push({ ...base, id: `${id}-fraud`, severity: top.severity, type: top.type, message });
        }
      }
      return alerts.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
    },

    listAudit: (filter?: { borrowerId?: string; actor?: string; limit?: number }) => store.listAudit(filter),

    /* ----- demo ----- */

    listPersonas: (): PersonaSummary[] =>
      PERSONAS.filter((p) => p.featured).map((p) => ({ borrower: borrower(p.borrower.id), report: report(p.borrower.id), story: p.story, expected: p.expected })),

    resetDemo: () => {
      store.reset();
      reportCache.clear();
    },

    /** Work sources (for the ingest/tracker setup screens). */
    workSources: (id: string) => sources(id).filter((s) => isActivitySource(s.type)),
  };
}

export type TrustlineService = ReturnType<typeof createTrustlineService>;
