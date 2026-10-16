import { API_BASE_URL } from "../config";
import type { ApplicantQuery } from "../types";
import { ApiError, type ApiClient } from "./client";

/**
 * REST adapter for the next phase. Endpoint paths mirror the method names so
 * the backend team has a clear contract. Auth headers are added here later.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(`${init?.method ?? "GET"} ${path} failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

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

export function createLiveAdapter(): ApiClient {
  return {
    getBorrower: (id) => request(`/borrowers/${id}`),
    startOnboarding: (id, input) => post(`/borrowers/${id}/onboarding`, input),
    submitKyc: (id) => post(`/borrowers/${id}/kyc`),
    setWorkType: (id, workType) => request(`/borrowers/${id}`, { method: "PATCH", body: JSON.stringify({ workType }) }),
    listSources: (id) => request(`/borrowers/${id}/sources`),
    connectSource: (id, sourceId) => post(`/borrowers/${id}/sources/${sourceId}/connect`),
    disconnectSource: (id, sourceId) => post(`/borrowers/${id}/sources/${sourceId}/disconnect`),
    getProfile: (id) => request(`/borrowers/${id}/profile`),
    setWorkItemShared: (id, itemId, shared) => request(`/borrowers/${id}/work-items/${itemId}`, { method: "PATCH", body: JSON.stringify({ shared }) }),
    uploadLessonRecording: (id, sourceId, recording) => post(`/borrowers/${id}/sources/${sourceId}/recordings`, recording),
    listLenders: () => request(`/lenders`),
    shareWithLender: (id, lenderId, opts) => post(`/borrowers/${id}/shares`, { lenderId, ...opts }),
    listShares: (id) => request(`/borrowers/${id}/shares`),
    revokeShare: (id, shareId) => post(`/borrowers/${id}/shares/${shareId}/revoke`),
    getApplicants: (q) => request(`/lender/applicants${qs(q)}`),
    getApplicant: (id) => request(`/lender/applicants/${id}`),
    getMonitoring: () => request(`/lender/monitoring`),
    listPersonas: () => Promise.reject(new ApiError("Demo personas are only available in mock mode", 404)),
    resetDemo: () => Promise.resolve(),
  };
}
