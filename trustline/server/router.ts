import { ApiError, type ConnectCredentials } from "@/lib/api/client";
import { normalizeIncomingEvents } from "@/lib/evidence/ingest";
import type { RealConnector, TrustlineService } from "@/lib/service/core";
import type { ApplicantQuery, Band, WorkType } from "@/lib/types";
import type { SqliteStore } from "./sqlite-store";

/**
 * REST API v1. Framework-free: takes a parsed request and returns status + JSON,
 * so it runs inside Next.js route handlers and directly in tests.
 */
export interface ApiRequest {
  method: string;
  path: string[];
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
  /** e.g. http://localhost:3000 — used to build webhook URLs. */
  origin: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

interface Deps {
  service: TrustlineService;
  sqlite: SqliteStore;
  connector: RealConnector;
}

type Handler = (req: ApiRequest, params: Record<string, string>) => unknown | Promise<unknown>;

const WORK_TYPES: WorkType[] = ["taxi", "delivery", "designer", "developer", "tutor", "beauty", "repair", "other"];

/* ---------- small validators ---------- */

function obj(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Request body must be a JSON object", 400);
  return body as Record<string, unknown>;
}
function str(o: Record<string, unknown>, key: string, opts: { optional?: boolean; max?: number } = {}): string {
  const v = o[key];
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return "";
    throw new ApiError(`'${key}' is required`, 400);
  }
  if (typeof v !== "string") throw new ApiError(`'${key}' must be a string`, 400);
  if (opts.max && v.length > opts.max) throw new ApiError(`'${key}' is too long`, 400);
  return v;
}
function num(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ApiError(`'${key}' must be a number`, 400);
  return v;
}
function strArray(o: Record<string, unknown>, key: string): string[] {
  const v = o[key];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new ApiError(`'${key}' must be a list of strings`, 400);
  return v as string[];
}

export function createRouter({ service, sqlite, connector }: Deps) {
  const lenderOf = (req: ApiRequest): string => {
    const auth = req.headers.get("authorization") ?? "";
    const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") ?? "").trim();
    if (!key) throw new ApiError("Missing API key. Send 'Authorization: Bearer <key>'.", 401);
    const lender = sqlite.lenderForKey(key);
    if (!lender) throw new ApiError("Invalid API key", 401);
    return lender;
  };

  const routes: [string, string, Handler][] = [
    ["GET", "health", () => service.health()],

    /* ----- borrower ----- */
    ["GET", "borrowers/:id", (_r, p) => service.getBorrower(p.id)],
    ["PATCH", "borrowers/:id", (r, p) => {
      const wt = str(obj(r.body), "workType") as WorkType;
      if (!WORK_TYPES.includes(wt)) throw new ApiError(`'workType' must be one of ${WORK_TYPES.join(", ")}`, 400);
      return service.setWorkType(p.id, wt);
    }],
    ["POST", "borrowers/:id/onboarding", (r, p) => {
      const b = obj(r.body);
      return service.startOnboarding(p.id, { name: str(b, "name", { max: 100 }), phone: str(b, "phone", { max: 30 }) });
    }],
    ["POST", "borrowers/:id/kyc", (_r, p) => service.submitKyc(p.id)],
    ["GET", "borrowers/:id/sources", (_r, p) => service.listSources(p.id)],
    ["POST", "borrowers/:id/sources/:sid/connect", (r, p) => {
      const b = r.body && typeof r.body === "object" ? (r.body as Record<string, unknown>) : {};
      const creds = b.credentials as ConnectCredentials | undefined;
      if (creds && (creds.github || creds.figma)) return service.connectWithConnector(p.id, p.sid, creds, connector);
      return service.connectSource(p.id, p.sid);
    }],
    ["POST", "borrowers/:id/sources/:sid/disconnect", (_r, p) => service.disconnectSource(p.id, p.sid)],
    ["POST", "borrowers/:id/sources/:sid/import", (r, p) => {
      if (typeof r.body === "string") return service.importWorkData(p.id, p.sid, { name: r.query.get("name") ?? "upload.csv", text: r.body });
      const b = obj(r.body);
      return service.importWorkData(p.id, p.sid, { name: str(b, "name", { max: 200 }), text: str(b, "text") });
    }],
    ["POST", "borrowers/:id/sources/:sid/recordings", (r, p) => {
      const b = obj(r.body);
      return service.uploadLessonRecording(p.id, p.sid, { name: str(b, "name", { max: 120 }), recordedMinutes: num(b, "recordedMinutes"), speechMinutes: num(b, "speechMinutes") });
    }],
    ["GET", "borrowers/:id/sources/:sid/ingest", (r, p) => {
      const src = service.listSources(p.id).find((s) => s.id === p.sid);
      if (!src) throw new ApiError("Source not found", 404);
      const key = sqlite.ingestKeyFor(p.id, p.sid);
      const webhookUrl = `${r.origin}/api/v1/ingest/${key}`;
      return {
        webhookUrl,
        key,
        exampleCurl: `curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"at":"${new Date().toISOString().slice(0, 16)}","minutes":45,"client":"Example client","amount":60}'`,
        trackerCommand: `node tracker/trustline-tracker.mjs --url ${webhookUrl} --apps "${src.provider.replace(/^Adobe /, "")}"`,
      };
    }],
    ["POST", "borrowers/:id/custom-sources", (r, p) => service.addCustomWorkApp(p.id, str(obj(r.body), "name", { max: 60 }))],
    ["GET", "borrowers/:id/profile", (_r, p) => service.getProfile(p.id)],
    ["PATCH", "borrowers/:id/work-items/:itemId", (r, p) => {
      const shared = obj(r.body).shared;
      if (typeof shared !== "boolean") throw new ApiError("'shared' must be true or false", 400);
      return service.setWorkItemShared(p.id, p.itemId, shared);
    }],
    ["GET", "borrowers/:id/shares", (_r, p) => service.listShares(p.id)],
    ["POST", "borrowers/:id/shares", (r, p) => {
      const b = obj(r.body);
      return service.shareWithLender(p.id, str(b, "lenderId"), { days: num(b, "days"), scope: strArray(b, "scope") });
    }],
    ["POST", "borrowers/:id/shares/:shareId/revoke", (_r, p) => service.revokeShare(p.id, p.shareId)],
    ["GET", "borrowers/:id/access-log", (_r, p) => service.listAudit({ borrowerId: p.id, limit: 50 })],
    ["GET", "lenders", () => service.listLenders()],

    /* ----- universal ingest (Zapier, Make, sensors, desktop tracker) ----- */
    ["POST", "ingest/:key", (r, p) => {
      const target = sqlite.resolveIngestKey(p.key);
      if (!target) throw new ApiError("Unknown ingest key", 401);
      const workType = service.getBorrower(target.borrower_id).workType;
      const channel = r.body && typeof r.body === "object" && (r.body as { source?: unknown }).source === "tracker" ? "tracker" : "webhook";
      let parsed;
      try {
        parsed = normalizeIncomingEvents(r.body, workType);
      } catch (e) {
        throw new ApiError(e instanceof Error ? e.message : "Invalid events", 400);
      }
      if (!parsed.events.length) throw new ApiError(`No valid events. ${parsed.rejected.map((x) => `#${x.index}: ${x.reason}`).join("; ")}`, 400);
      const label = channel === "tracker" ? "Desktop tracker" : (r.headers.get("user-agent")?.includes("Zapier") ? "Zapier" : "Webhook");
      service.ingestEvents(target.borrower_id, target.source_id, parsed.events, channel, label);
      return { accepted: parsed.events.length, rejected: parsed.rejected };
    }],

    /* ----- lender (API key required) ----- */
    ["GET", "lender/applicants", (r) => {
      const q: ApplicantQuery = {
        search: r.query.get("search") ?? undefined,
        bands: r.query.getAll("band") as Band[],
        workTypes: r.query.getAll("workType") as WorkType[],
        sortBy: (r.query.get("sortBy") as ApplicantQuery["sortBy"]) ?? undefined,
        sortDir: (r.query.get("sortDir") as ApplicantQuery["sortDir"]) ?? undefined,
      };
      return service.getApplicants(lenderOf(r), q);
    }],
    ["GET", "lender/applicants/:id", (r, p) => service.getApplicant(lenderOf(r), p.id)],
    ["GET", "lender/monitoring", (r) => service.getMonitoring(lenderOf(r))],
    ["GET", "lender/audit", (r) => service.listAudit({ actor: `lender:${lenderOf(r)}`, limit: 100 })],
    ["POST", "reports", (r) => service.redeemShareCode(lenderOf(r), str(obj(r.body), "shareCode", { max: 20 }))],

    /* ----- demo ----- */
    ["GET", "demo/personas", () => service.listPersonas()],
    ["POST", "demo/reset", () => {
      service.resetDemo();
      return { ok: true };
    }],
  ];

  const match = (pattern: string, path: string[]): Record<string, string> | null => {
    const parts = pattern.split("/");
    if (parts.length !== path.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(path[i]);
      else if (parts[i] !== path[i]) return null;
    }
    return params;
  };

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      let pathMatched = false;
      for (const [method, pattern, handler] of routes) {
        const params = match(pattern, req.path);
        if (!params) continue;
        pathMatched = true;
        if (method !== req.method) continue;
        return { status: 200, body: await handler(req, params) };
      }
      return pathMatched ? { status: 405, body: { error: "Method not allowed" } } : { status: 404, body: { error: `No API route for /${req.path.join("/")}` } };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, body: { error: e.message } };
      console.error("[api] unexpected error", e);
      return { status: 500, body: { error: "Something went wrong on the server" } };
    }
  };
}
