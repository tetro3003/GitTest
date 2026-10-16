import { createTrustlineService } from "@/lib/service/core";
import { realConnector } from "./connectors";
import { openDatabase } from "./db";
import { createRouter, type ApiRequest } from "./router";
import { createSqliteStore } from "./sqlite-store";

/** One database + service per server process (kept across hot reloads in dev). */
function build() {
  const db = openDatabase();
  const sqlite = createSqliteStore(db);
  const service = createTrustlineService(sqlite.store);
  return { db, sqlite, service, handle: createRouter({ service, sqlite, connector: realConnector }) };
}

const g = globalThis as unknown as { __trustline?: ReturnType<typeof build> };
export const backend = () => (g.__trustline ??= build());

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

/** Adapter from a Web Request (Next.js route handler) to the framework-free router. */
export async function handleHttp(req: Request, path: string[]): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let body: unknown = undefined;
  if (req.method !== "GET") {
    const type = req.headers.get("content-type") ?? "";
    const text = await req.text();
    if (text) {
      if (type.includes("json") || /^\s*[[{]/.test(text)) {
        try {
          body = JSON.parse(text);
        } catch {
          return Response.json({ error: "Body is not valid JSON" }, { status: 400, headers: CORS });
        }
      } else body = text;
    }
  }
  const url = new URL(req.url);
  const apiReq: ApiRequest = { method: req.method, path, query: url.searchParams, headers: req.headers, body, origin: url.origin };
  const res = await backend().handle(apiReq);
  return Response.json(res.body, { status: res.status, headers: CORS });
}
