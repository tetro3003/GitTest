import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db";
import { createBetaHttp } from "@/server/beta/http";
import { createBetaService } from "@/server/beta/service";
import { createBetaStore } from "@/server/beta/store";
import { createVault } from "@/server/beta/vault";

/** A fake Berlin-Group bank: consent → approve on the bank page → accounts with owner name. */
function fakeBank(opts: { owner: string; status?: string }) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: string }[] = [];
  const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? "GET", url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: init?.body ? String(init.body) : undefined });
    if (url === "https://bank.test/token") return ok({ access_token: "app-token", token_type: "Bearer" });
    if (url === "https://bank.test/ob/v1/consents") return ok({ consentId: "cons-123456789", consentStatus: "received", _links: { scaRedirect: { href: "https://bank.test/approve/cons-123456789" } } }, 201);
    if (url === "https://bank.test/ob/v1/consents/cons-123456789/status") return ok({ consentStatus: opts.status ?? "valid" });
    if (url === "https://bank.test/ob/v1/accounts") return ok({ accounts: [{ resourceId: "a1", iban: "GE29TB0000000000001234", currency: "GEL", ownerName: opts.owner }] });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

async function setup(owner: string, status?: string) {
  const bank = fakeBank({ owner, status });
  const service = createBetaService({ store: createBetaStore(openDatabase(":memory:")), vault: createVault(Buffer.alloc(32, 9)), fetch: bank.f, now: () => new Date("2026-10-15T12:00:00Z") });
  const handle = createBetaHttp(service);
  let cookie = "";
  const call = async <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => {
    const res = await handle(new Request(`http://localhost:3000/api/beta/${path}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }), path.split("?")[0].split("/"));
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, location: res.headers.get("location"), body: (res.status === 302 ? {} : await res.json()) as T };
  };
  await call("POST", "signup", { email: "nino@example.com", name: "Nino Beridze", password: "password123" });
  const me = (await call<{ user: { id: string } }>("GET", "me")).body.user.id;
  const confirm = async () => {
    const start = await call<{ url: string }>("POST", "bank-id/tbc/start", {});
    expect(start.status).toBe(200);
    expect(start.body.url).toBe("https://bank.test/approve/cons-123456789");
    const redirect = JSON.parse(bank.calls.find((c) => c.url.endsWith("/v1/consents"))!.body!);
    const back = bank.calls.find((c) => c.url.endsWith("/v1/consents"))!.headers["tpp-redirect-uri"];
    const state = new URL(back).searchParams.get("state")!;
    const cb = await call("GET", `bank-id/tbc/callback?state=${state}`);
    return { redirect, cb };
  };
  return { call, service, me, bank, confirm };
}

describe("identity through open banking", () => {
  beforeEach(() => {
    process.env.TBC_OB_BASE_URL = "https://bank.test/ob";
    process.env.TBC_OB_TOKEN_URL = "https://bank.test/token";
    process.env.TBC_OB_CLIENT_ID = "trustline";
    process.env.TBC_OB_CLIENT_SECRET = "secret";
  });
  afterEach(() => ["BASE_URL", "TOKEN_URL", "CLIENT_ID", "CLIENT_SECRET"].forEach((k) => delete process.env[`TBC_OB_${k}`]));

  it("asks only for owner names, then confirms the matching name", async () => {
    const { confirm, bank, service, me, call } = await setup("BERIDZE NINO");
    const { redirect, cb } = await confirm();
    expect(redirect.access).toEqual({ availableAccounts: "allAccountsWithOwnerName" });
    expect(redirect.recurringIndicator).toBe(false);
    expect(cb.location).toContain("/beta?bankid=ok");
    expect(bank.calls.find((c) => c.url.endsWith("/v1/accounts"))!.headers["consent-id"]).toBe("cons-123456789");
    expect(bank.calls.every((c) => !c.url.includes("transactions") && !c.url.includes("balances"))).toBe(true);
    const ids = service.bankIdentities(me);
    expect(ids).toEqual([expect.objectContaining({ bank: "tbc", holderName: "BERIDZE NINO", matchesAccount: true, accounts: ["1234"] })]);
    expect((await call<{ banks: unknown[] }>("GET", "identity")).body.banks).toHaveLength(1);
    // Identity points need income to show; the missing list no longer asks for identity.
    expect(service.score(me).missing.join(" ")).not.toMatch(/Confirm who you are/);
  });

  it("reports a different account holder and doesn't count it", async () => {
    const { confirm, service, me } = await setup("Giorgi Maisuradze");
    const { cb } = await confirm();
    expect(decodeURIComponent(cb.location!)).toContain("belongs to “Giorgi Maisuradze”");
    expect(service.bankIdentities(me)[0].matchesAccount).toBe(false);
    expect(service.score(me).missing.join(" ")).toMatch(/Confirm who you are/);
  });

  it("handles a declined permission", async () => {
    const { confirm, service, me } = await setup("Nino Beridze", "rejected");
    const { cb } = await confirm();
    expect(decodeURIComponent(cb.location!)).toContain("You declined at the bank");
    expect(service.bankIdentities(me)).toEqual([]);
  });

  it("says when a bank isn't set up", async () => {
    const { call } = await setup("Nino Beridze");
    const r = await call<{ error: string }>("POST", "bank-id/bog/start", {});
    expect(r.status).toBe(501);
  });
});
