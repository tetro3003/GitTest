import { API_BASE_URL, LENDER_API_KEY } from "../config";
import type { ApplicantQuery } from "../types";
import { ApiError, type ApiClient } from "./client";

/**
 * REST adapter: talks to the Trustline backend (server/router.ts).
 * Lender endpoints send the lender API key.
 */
async function request<T>(path: string, init?: RequestInit & { lender?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.lender ? { Authorization: `Bearer ${LENDER_API_KEY}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Can't reach the Trustline server. Is it running (npm run dev)?", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `${init?.method ?? "GET"} ${path} failed (${res.status})`, res.status);
  return data as T;
}

const post = <T>(path: string, body?: unknown, lender = false) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), lender });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

function qs(q?: ApplicantQuery): string {
  if (!q) return "";
  const p = new URLSearchParams();
  if (q.search) p.set("search", q.search);
  q.bands?.forEach((b) => p.append("band", b));
  q.workTypes?.forEach((w) => p.append("workType", w));
  if (q.sortBy) p.set("sortBy", q.sortBy);
  if (q.sortDir) p.set("sortDir", q.sortDir);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const b = (id: string) => `/borrowers/${encodeURIComponent(id)}`;

export function createLiveAdapter(): ApiClient {
  return {
    getBorrower: (id) => request(b(id)),
    startOnboarding: (id, input) => post(`${b(id)}/onboarding`, input),
    submitKyc: (id) => post(`${b(id)}/kyc`),
    setWorkType: (id, workType) => patch(b(id), { workType }),
    listSources: (id) => request(`${b(id)}/sources`),
    connectSource: (id, sid, credentials) => post(`${b(id)}/sources/${sid}/connect`, credentials ? { credentials } : {}),
    disconnectSource: (id, sid) => post(`${b(id)}/sources/${sid}/disconnect`),
    getProfile: (id) => request(`${b(id)}/profile`),
    setWorkItemShared: (id, itemId, shared) => patch(`${b(id)}/work-items/${encodeURIComponent(itemId)}`, { shared }),
    uploadLessonRecording: (id, sid, rec) => post(`${b(id)}/sources/${sid}/recordings`, rec),
    importWorkData: (id, sid, file) => post(`${b(id)}/sources/${sid}/import`, file),
    addCustomWorkApp: (id, name) => post(`${b(id)}/custom-sources`, { name }),
    getIngestSetup: (id, sid) => request(`${b(id)}/sources/${sid}/ingest`),
    getAccessLog: (id) => request(`${b(id)}/access-log`),
    listLenders: () => request(`/lenders`),
    shareWithLender: (id, lenderId, opts) => post(`${b(id)}/shares`, { lenderId, ...opts }),
    listShares: (id) => request(`${b(id)}/shares`),
    revokeShare: (id, shareId) => post(`${b(id)}/shares/${shareId}/revoke`),
    getApplicants: (q) => request(`/lender/applicants${qs(q)}`, { lender: true }),
    getApplicant: (id) => request(`/lender/applicants/${encodeURIComponent(id)}`, { lender: true }),
    getMonitoring: () => request(`/lender/monitoring`, { lender: true }),
    listPersonas: () => request(`/demo/personas`),
    resetDemo: () => post<{ ok: boolean }>(`/demo/reset`).then(() => undefined),
  };
}
