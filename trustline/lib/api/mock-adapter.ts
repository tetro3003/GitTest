import { DEMO_AS_OF, MOCK_LATENCY } from "../config";
import { addDays } from "../dates";
import { buildScoringInput } from "../mock/dataset";
import { consentsFor, getDb, LENDERS, NOW_ISO, resetDb, saveDb, shareCode, sourcesFor } from "../mock/db";
import { getPersona, PERSONAS, type PersonaDefinition } from "../mock/personas";
import { computeScoreReport } from "../scoring";
import { weeklyTotals } from "../scoring/activity";
import type {
  ApplicantSummary,
  Borrower,
  MonitoringAlert,
  ScoreReport,
  ScoringInput,
  Severity,
  WorkItem,
} from "../types";
import { ApiError, type ApiClient } from "./client";

/* ---------- helpers ---------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulated network: latency, optional random failures, and a deep copy so callers can't mutate "server" state. */
async function respond<T>(fn: () => T): Promise<T> {
  const [lo, hi] = MOCK_LATENCY;
  await sleep(lo + Math.random() * (hi - lo));
  if (Math.random() < getDb().failRate) throw new ApiError("Network error (simulated)", 503);
  return structuredClone(fn());
}

function persona(id: string): PersonaDefinition {
  const p = getPersona(id);
  if (!p) throw new ApiError(`Borrower ${id} not found`, 404);
  return p;
}

function borrowerOf(id: string): Borrower {
  const p = persona(id);
  const st = getDb().borrowers[id];
  const sources = sourcesFor(id, p.spec.sources);
  return {
    ...p.borrower,
    name: st.name,
    phone: st.phone,
    workType: st.workType,
    kycStatus: st.kycStatus,
    applicationStatus: st.applicationStatus,
    connectedSources: sources,
    consents: consentsFor(id, sources),
  };
}

const reportCache = new Map<string, ScoreReport>();

/** Engine input built from what this borrower currently shares. */
function inputOf(id: string): ScoringInput {
  const p = persona(id);
  const st = getDb().borrowers[id];
  const def = { ...p, borrower: { ...p.borrower, workType: st.workType } };
  return buildScoringInput(def, sourcesFor(id, p.spec.sources), DEMO_AS_OF, st.items ?? {}, st.uploads ?? []);
}

function reportOf(id: string): ScoreReport {
  const st = getDb().borrowers[id];
  const sources = sourcesFor(id, persona(id).spec.sources);
  const key = JSON.stringify([id, st.workType, sources.filter((s) => s.status === "connected").map((s) => s.id), st.items, st.uploads?.map((u) => u.id)]);
  const hit = reportCache.get(key);
  if (hit) return hit;
  const report = computeScoreReport(inputOf(id), `${DEMO_AS_OF}T08:00:00.000Z`);
  reportCache.set(key, report);
  return report;
}


const SEV_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

function summary(id: string): ApplicantSummary {
  const b = borrowerOf(id);
  const r = reportOf(id);
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

/* ---------- adapter ---------- */

export function createMockAdapter(): ApiClient {
  return {
    getBorrower: (id) => respond(() => borrowerOf(id)),

    startOnboarding: (id, input) =>
      respond(() => {
        const st = getDb().borrowers[id];
        if (!st) throw new ApiError("Borrower not found", 404);
        st.name = input.name.trim() || st.name;
        st.phone = input.phone.trim() || st.phone;
        st.kycStatus = "not_started";
        for (const s of Object.values(st.sources)) {
          s.status = "available";
          s.connectedAt = null;
        }
        st.items = {};
        st.uploads = [];
        saveDb();
        return borrowerOf(id);
      }),

    submitKyc: async (id) => {
      // KYC takes a little longer, like a real vendor.
      await sleep(1200);
      return respond(() => {
        getDb().borrowers[id].kycStatus = "verified";
        saveDb();
        return borrowerOf(id);
      });
    },

    setWorkType: (id, workType) =>
      respond(() => {
        getDb().borrowers[id].workType = workType;
        saveDb();
        return borrowerOf(id);
      }),

    listSources: (id) => respond(() => borrowerOf(id).connectedSources),

    connectSource: async (id, sourceId) => {
      await sleep(900); // OAuth round-trip
      return respond(() => {
        const s = getDb().borrowers[id]?.sources[sourceId];
        if (!s) throw new ApiError("Source not found", 404);
        s.status = "connected";
        s.connectedAt = NOW_ISO();
        saveDb();
        return borrowerOf(id).connectedSources.find((x) => x.id === sourceId) as Borrower["connectedSources"][number];
      });
    },

    disconnectSource: (id, sourceId) =>
      respond(() => {
        const s = getDb().borrowers[id]?.sources[sourceId];
        if (!s) throw new ApiError("Source not found", 404);
        s.status = s.connectedAt ? "revoked" : "available";
        saveDb();
        return borrowerOf(id).connectedSources.find((x) => x.id === sourceId) as Borrower["connectedSources"][number];
      }),

    getProfile: (id) =>
      respond(() => {
        const input = inputOf(id);
        return { borrower: borrowerOf(id), report: reportOf(id), activity: input.activity, workItems: input.workItems };
      }),

    setWorkItemShared: (id, itemId, shared) =>
      respond(() => {
        const st = getDb().borrowers[id];
        const upload = st.uploads.find((u) => u.id === itemId);
        if (upload) upload.shared = shared;
        else st.items[itemId] = shared;
        saveDb();
        return inputOf(id).workItems;
      }),

    uploadLessonRecording: async (id, sourceId, rec) => {
      await sleep(600);
      return respond(() => {
        const st = getDb().borrowers[id];
        const item: WorkItem = {
          id: `${sourceId}-upload-${Date.now().toString(36)}`,
          sourceId,
          name: rec.name,
          weight: 0,
          shared: true,
          lastActivity: DEMO_AS_OF,
          stats: { recordedMinutes: rec.recordedMinutes, speechMinutes: rec.speechMinutes, hours: Math.round((rec.speechMinutes / 60) * 10) / 10 },
        };
        st.uploads.push(item);
        saveDb();
        return item;
      });
    },

    listLenders: () => respond(() => LENDERS),

    shareWithLender: (id, lenderId, opts) =>
      respond(() => {
        const lender = LENDERS.find((l) => l.id === lenderId);
        if (!lender) throw new ApiError("Lender not found", 404);
        const now = NOW_ISO();
        const share = {
          id: `share-${id}-${Date.now().toString(36)}`,
          borrowerId: id,
          lenderId,
          lenderName: lender.name,
          code: shareCode(`${id}${lenderId}${Date.now()}`),
          scope: opts.scope,
          createdAt: now,
          expiresAt: `${addDays(now.slice(0, 10), opts.days)}T23:59:59.000Z`,
          status: "active" as const,
        };
        getDb().shares.unshift(share);
        saveDb();
        return share;
      }),

    listShares: (id) => respond(() => getDb().shares.filter((s) => s.borrowerId === id)),

    revokeShare: (id, shareId) =>
      respond(() => {
        const share = getDb().shares.find((s) => s.id === shareId && s.borrowerId === id);
        if (!share) throw new ApiError("Share not found", 404);
        share.status = "revoked";
        saveDb();
        return share;
      }),

    getApplicants: (q) =>
      respond(() => {
        let rows = PERSONAS.map((p) => summary(p.borrower.id));
        if (q?.search) {
          const s = q.search.toLowerCase();
          rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.city.toLowerCase().includes(s));
        }
        if (q?.bands?.length) rows = rows.filter((r) => q.bands?.includes(r.band));
        if (q?.workTypes?.length) rows = rows.filter((r) => q.workTypes?.includes(r.workType));
        const dir = q?.sortDir === "asc" ? 1 : -1;
        const by = q?.sortBy ?? "appliedAt";
        rows.sort((a, b) => {
          const va = by === "score" ? a.score : by === "income" ? a.verifiedMonthlyIncome : by === "name" ? a.name : a.appliedAt;
          const vb = by === "score" ? b.score : by === "income" ? b.verifiedMonthlyIncome : by === "name" ? b.name : b.appliedAt;
          return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
        });
        return rows;
      }),

    getApplicant: (id) =>
      respond(() => {
        const input = inputOf(id);
        return {
          borrower: borrowerOf(id),
          report: reportOf(id),
          transactions: input.transactions,
          activity: input.activity,
          invoices: input.invoices,
          obligations: input.obligations,
          workItems: input.workItems,
        };
      }),

    getMonitoring: () =>
      respond(() => {
        const alerts: MonitoringAlert[] = [];
        for (const p of PERSONAS) {
          const id = p.borrower.id;
          const r = reportOf(id);
          const trend = weeklyTotals(inputOf(id).activity)
            .slice(-12)
            .map((w) => w.hours);
          const base = { borrowerId: id, borrowerName: getDb().borrowers[id].name, workType: p.borrower.workType, detectedAt: addDays(DEMO_AS_OF, -1), trend };
          r.earlyWarnings.forEach((w, i) => alerts.push({ ...base, id: `${id}-w${i}`, severity: w.severity, type: w.type, message: w.message }));
          if (r.fraudFlags.length) {
            const top = r.fraudFlags.reduce((a, f) => (SEV_RANK[f.severity] > SEV_RANK[a.severity] ? f : a));
            const message =
              r.fraudFlags.length === 1 ? top.title : `${r.fraudFlags.length} fraud flags: ${r.fraudFlags.map((f) => f.title.toLowerCase()).join(", ")}`;
            alerts.push({ ...base, id: `${id}-fraud`, severity: top.severity, type: top.type, message });
          }
        }
        return alerts.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
      }),

    listPersonas: () =>
      respond(() =>
        PERSONAS.filter((p) => p.featured).map((p) => ({
          borrower: borrowerOf(p.borrower.id),
          report: reportOf(p.borrower.id),
          story: p.story,
          expected: p.expected,
        })),
      ),

    resetDemo: () =>
      respond(() => {
        resetDb();
        reportCache.clear();
      }),
  };
}

/** Exposed for the demo panel's "simulate errors" switch. */
export function setMockFailRate(rate: number): void {
  getDb().failRate = rate;
  saveDb();
}
