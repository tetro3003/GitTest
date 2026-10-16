import { MOCK_LATENCY } from "../config";
import { getFailRate, localStore, setFailRate } from "../mock/db";
import { createTrustlineService } from "../service/core";
import { DEMO_LENDER_ID } from "../service/seed";
import { ApiError, type ApiClient } from "./client";

/**
 * Mock adapter: runs the real Trustline service in the browser on top of
 * localStorage, with simulated latency and optional random failures.
 */
const service = createTrustlineService(localStore);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function respond<T>(fn: () => T, extraDelay = 0): Promise<T> {
  const [lo, hi] = MOCK_LATENCY;
  await sleep(lo + Math.random() * (hi - lo) + extraDelay);
  if (Math.random() < getFailRate()) throw new ApiError("Network error (simulated)", 503);
  return structuredClone(fn());
}

export function createMockAdapter(): ApiClient {
  return {
    getBorrower: (id) => respond(() => service.getBorrower(id)),
    startOnboarding: (id, input) => respond(() => service.startOnboarding(id, input)),
    submitKyc: (id) => respond(() => service.submitKyc(id), 1200),
    setWorkType: (id, wt) => respond(() => service.setWorkType(id, wt)),
    listSources: (id) => respond(() => service.listSources(id)),
    connectSource: (id, sid, credentials) => {
      if (credentials && (credentials.github || credentials.figma))
        return Promise.reject(new ApiError("Real GitHub and Figma connections need the backend. Run the app on your laptop (npm run dev) to use them.", 501));
      return respond(() => service.connectSource(id, sid), 900);
    },
    disconnectSource: (id, sid) => respond(() => service.disconnectSource(id, sid)),
    getProfile: (id) => respond(() => service.getProfile(id)),
    setWorkItemShared: (id, itemId, shared) => respond(() => service.setWorkItemShared(id, itemId, shared)),
    uploadLessonRecording: (id, sid, rec) => respond(() => service.uploadLessonRecording(id, sid, rec), 600),
    importWorkData: (id, sid, file) => respond(() => service.importWorkData(id, sid, file), 700),
    addCustomWorkApp: (id, name) => respond(() => service.addCustomWorkApp(id, name)),
    getIngestSetup: () => Promise.reject(new ApiError("Live webhooks and the desktop tracker need the backend. Run the app on your laptop (npm run dev) to use them.", 501)),
    getAccessLog: (id) => respond(() => service.listAudit({ borrowerId: id, limit: 50 })),
    listLenders: () => respond(() => service.listLenders()),
    shareWithLender: (id, lenderId, o) => respond(() => service.shareWithLender(id, lenderId, o)),
    listShares: (id) => respond(() => service.listShares(id)),
    revokeShare: (id, shareId) => respond(() => service.revokeShare(id, shareId)),
    getApplicants: (q) => respond(() => service.getApplicants(DEMO_LENDER_ID, q)),
    getApplicant: (id) => respond(() => service.getApplicant(DEMO_LENDER_ID, id)),
    getMonitoring: () => respond(() => service.getMonitoring(DEMO_LENDER_ID)),
    listPersonas: () => respond(() => service.listPersonas()),
    resetDemo: () => respond(() => service.resetDemo()),
  };
}

/** Exposed for the demo panel's "simulate errors" switch. */
export function setMockFailRate(rate: number): void {
  setFailRate(rate);
}
