import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createTrustlineService } from "@/lib/service/core";
import { openDatabase } from "@/server/db";
import { createRouter } from "@/server/router";
import { createSqliteStore, DEMO_LENDER_KEY } from "@/server/sqlite-store";
import { fetchGitHubWork } from "@/server/connectors/github";
import { fetchFigmaWork, figmaFileKey } from "@/server/connectors/figma";
import type { ApplicantSummary, BorrowerProfile, DataSource, ImportSummary, Share } from "@/lib/types";

const sample = (f: string) => readFileSync(join(__dirname, "../public/samples", f), "utf8");

function setup() {
  const db = openDatabase(":memory:");
  const sqlite = createSqliteStore(db);
  const service = createTrustlineService(sqlite.store);
  const handle = createRouter({ service, sqlite, connector: async () => ({ label: "fake", events: [{ at: "2026-09-20T10:00:00.000Z", minutes: 60, kind: "commit" }] }) });
  const call = async <T = unknown>(method: string, path: string, body?: unknown, opts: { lender?: boolean; key?: string } = {}) => {
    const headers = new Headers();
    if (opts.lender) headers.set("authorization", `Bearer ${opts.key ?? DEMO_LENDER_KEY}`);
    const url = new URL(`http://localhost:3000/api/v1/${path}`);
    const res = await handle({ method, path: url.pathname.split("/").slice(3), query: url.searchParams, headers, body, origin: url.origin });
    return res as { status: number; body: T };
  };
  return { call, sqlite, service };
}

describe("REST API", () => {
  let api: ReturnType<typeof setup>;
  beforeEach(() => {
    api = setup();
  });

  it("answers health and 404s unknown routes", async () => {
    expect((await api.call("GET", "health")).status).toBe(200);
    expect((await api.call("GET", "nope")).status).toBe(404);
  });

  it("serves a borrower profile computed on the server", async () => {
    const r = await api.call<BorrowerProfile>("GET", "borrowers/giorgi/profile");
    expect(r.status).toBe(200);
    expect(r.body.report.band).toBe("A");
    expect(r.body.report.workCheck.status).toBe("strong");
  });

  it("requires a valid lender API key", async () => {
    expect((await api.call("GET", "lender/applicants")).status).toBe(401);
    expect((await api.call("GET", "lender/applicants", undefined, { lender: true, key: "wrong" })).status).toBe(401);
    const ok = await api.call<ApplicantSummary[]>("GET", "lender/applicants", undefined, { lender: true });
    expect(ok.status).toBe(200);
    expect(ok.body.length).toBeGreaterThanOrEqual(10);
  });

  it("revoking a share removes the lender's access immediately", async () => {
    const shares = (await api.call<Share[]>("GET", "borrowers/giorgi/shares")).body;
    const cityBank = shares.find((s) => s.lenderId === "city-bank" && s.status === "active");
    expect(cityBank).toBeDefined();
    expect((await api.call("GET", "lender/applicants/giorgi", undefined, { lender: true })).status).toBe(200);
    await api.call("POST", `borrowers/giorgi/shares/${cityBank?.id}/revoke`);
    expect((await api.call("GET", "lender/applicants/giorgi", undefined, { lender: true })).status).toBe(403);
    const list = (await api.call<ApplicantSummary[]>("GET", "lender/applicants", undefined, { lender: true })).body;
    expect(list.map((a) => a.id)).not.toContain("giorgi");
  });

  it("redeems a share code for a report and logs it", async () => {
    const share = (await api.call<Share[]>("GET", "borrowers/nino/shares")).body[0];
    const r = await api.call<{ reportId: string; report: { band: string } }>("POST", "reports", { shareCode: share.code }, { lender: true });
    expect(r.status).toBe(200);
    expect(r.body.report.band).toBe("B");
    const log = (await api.call<{ action: string }[]>("GET", "borrowers/nino/access-log")).body;
    expect(log.map((l) => l.action)).toContain("report.redeemed");
  });

  it("persists state in the database across service instances", async () => {
    await api.call("PATCH", "borrowers/sandro", { workType: "developer" });
    const fresh = createTrustlineService(api.sqlite.store);
    expect(fresh.getBorrower("sandro").workType).toBe("developer");
  });

  it("validates input", async () => {
    expect((await api.call("PATCH", "borrowers/sandro", { workType: "astronaut" })).status).toBe(400);
    expect((await api.call("POST", "borrowers/sandro/shares", { lenderId: "city-bank" })).status).toBe(400);
  });
});

describe("universal work data", () => {
  let api: ReturnType<typeof setup>;
  beforeEach(() => {
    api = setup();
  });

  const boltId = "giorgi-bolt";

  it("imports a real-shaped Bolt export and the bank cross-check passes", async () => {
    const r = await api.call<{ summary: ImportSummary }>("POST", `borrowers/giorgi/sources/${boltId}/import`, { name: "bolt.csv", text: sample("bolt-earnings-sample.csv") });
    expect(r.status).toBe(200);
    expect(r.body.summary.columns).toMatchObject({ start: "Trip date", duration: "Duration (min)", amount: "Fare (GEL)", distance: "Distance (km)", status: "Status" });
    expect(r.body.summary.skipped).toBeGreaterThan(0); // cancelled trips
    const p = (await api.call<BorrowerProfile>("GET", "borrowers/giorgi/profile")).body;
    const cross = p.report.workCheck.evidence.find((e) => e.label === "Earnings in work data vs bank deposits");
    expect(cross?.ok).toBe(true);
    expect(p.borrower.connectedSources.find((s) => s.id === boltId)?.evidence?.channel).toBe("file");
  });

  it("catches a faked export whose earnings never reached the bank", async () => {
    await api.call("POST", `borrowers/giorgi/sources/${boltId}/import`, { name: "bolt.csv", text: sample("bolt-earnings-FAKED.csv") });
    const p = (await api.call<BorrowerProfile>("GET", "borrowers/giorgi/profile")).body;
    expect(p.report.workCheck.status).toBe("mismatch");
    expect(p.report.fraudFlags.map((f) => f.type)).toContain("income_activity_mismatch");
  });

  it.each([
    ["sandro", "sandro-wolt", "wolt-shifts-sample.csv"],
    ["keti", "keti-booksy", "booksy-appointments-sample.csv"],
    ["levan", "levan-zoom", "zoom-meetings-sample.csv"],
    ["mariam", "mariam-figma", "toggl-figma-sample.csv"],
    ["nino", "nino-jira", "jira-worklog-sample.csv"],
  ])("imports the %s sample (%s)", async (borrower, source, file) => {
    const r = await api.call<{ summary: ImportSummary }>("POST", `borrowers/${borrower}/sources/${source}/import`, { name: file, text: sample(file) });
    expect(r.status).toBe(200);
    expect(r.body.summary.imported).toBeGreaterThan(20);
    expect(r.body.summary.hours).toBeGreaterThan(10);
  });

  it("accepts webhook events for any app via an ingest key", async () => {
    const custom = (await api.call<DataSource>("POST", "borrowers/irakli/custom-sources", { name: "ServiceTitan" })).body;
    const setupInfo = (await api.call<{ key: string; webhookUrl: string }>("GET", `borrowers/irakli/sources/${custom.id}/ingest`)).body;
    expect(setupInfo.webhookUrl).toContain(`/api/v1/ingest/${setupInfo.key}`);
    const events = Array.from({ length: 30 }, (_, i) => ({ at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T10:00`, duration: "2h", client: `Job ${i}`, amount: 80 }));
    const r = await api.call<{ accepted: number }>("POST", `ingest/${setupInfo.key}`, { events });
    expect(r.body.accepted).toBe(30);
    expect((await api.call("POST", "ingest/not-a-key", { events })).status).toBe(401);
    const src = (await api.call<DataSource[]>("GET", "borrowers/irakli/sources")).body.find((s) => s.id === custom.id);
    expect(src?.evidence).toMatchObject({ channel: "webhook", events: 30 });
  });

  it("records desktop tracker sessions as their own channel", async () => {
    const key = (await api.call<{ key: string }>("GET", "borrowers/mariam/sources/mariam-ps/ingest")).body.key;
    const r = await api.call<{ accepted: number }>("POST", `ingest/${key}`, { source: "tracker", events: [{ at: "2026-09-28T10:00:00Z", minutes: 5, kind: "app_session", item: "Photoshop" }] });
    expect(r.body.accepted).toBe(1);
    const src = (await api.call<DataSource[]>("GET", "borrowers/mariam/sources")).body.find((s) => s.id === "mariam-ps");
    expect(src?.evidence?.channel).toBe("tracker");
  });

  it("rejects files without a date column with a helpful message", async () => {
    const r = await api.call<{ error: string }>("POST", `borrowers/giorgi/sources/${boltId}/import`, { name: "x.csv", text: "a,b\n1,2\n3,4" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/date column/);
  });
});

describe("API connectors (with recorded responses)", () => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  it("turns GitHub commits and merged PRs into work events", async () => {
    const fake: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/users/")) return json({ login: "dev" });
      if (url.includes("/search/commits"))
        return json({ items: [1, 2, 3].map((d) => ({ commit: { author: { date: `2026-09-1${d}T10:00:00Z` } }, repository: { full_name: "dev/app" } })) });
      if (url.includes("/search/issues")) return json({ items: [{ closed_at: "2026-09-14T12:00:00Z", comments: 2, repository_url: "https://api.github.com/repos/dev/app", pull_request: { merged_at: "2026-09-14T12:00:00Z" } }] });
      return json({}, 404);
    };
    const r = await fetchGitHubWork("dev", { fetch: fake, now: new Date("2026-10-01") });
    expect(r.events.filter((e) => e.kind === "commit")).toHaveLength(3);
    expect(r.events.find((e) => e.kind === "review")?.units).toBe(2);
    await expect(fetchGitHubWork("bad name!", { fetch: fake })).rejects.toThrow(/username/);
  });

  it("turns Figma versions and comments into design sessions", async () => {
    expect(figmaFileKey("https://www.figma.com/design/AbCdEf123456/Banking-app?node-id=1")).toBe("AbCdEf123456");
    const fake: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/me")) return json({ id: "me", handle: "mariam" });
      if (url.includes("/versions")) return json({ versions: [{ created_at: "2026-09-10T10:00:00Z", user: { id: "me" } }, { created_at: "2026-09-10T10:30:00Z", user: { id: "me" } }, { created_at: "2026-09-11T09:00:00Z", user: { id: "other" } }] });
      if (url.includes("/comments")) return json({ comments: [{ created_at: "2026-09-12T09:00:00Z", user: { id: "client" } }] });
      return json({ name: "Banking app" });
    };
    const r = await fetchFigmaWork("tok", ["https://www.figma.com/file/AbCdEf123456/x"], { fetch: fake });
    expect(r.events.filter((e) => e.kind === "design_session")).toEqual([expect.objectContaining({ minutes: 60, item: "Banking app" })]);
    expect(r.events.filter((e) => e.kind === "client_comment")).toHaveLength(1);
  });
});
