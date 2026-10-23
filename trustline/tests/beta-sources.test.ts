import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dkimSign } from "mailauth";
import { reconcilePayments, matchClients } from "@/lib/beta/reconcile";
import { nameTokens, samePerson } from "@/lib/beta/names";
import type { PaymentFact } from "@/lib/beta/types";
import { openDatabase } from "@/server/db";
import { createBetaHttp } from "@/server/beta/http";
import { mrzCheckDigit, parseMrz, evaluateId } from "@/server/beta/idcheck";
import { parseBankFile } from "@/server/beta/providers/bank-import";
import { classifyByRules, findAmount, findPayer } from "@/server/beta/providers/email-extract";
import { verifyPaymentEmail } from "@/server/beta/providers/gmail";
import { createBetaService } from "@/server/beta/service";
import { createBetaStore } from "@/server/beta/store";
import { createVault } from "@/server/beta/vault";

const NOW = new Date("2026-10-15T12:00:00.000Z");

/* ---------- DKIM-signed test emails ---------- */

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PUB_B64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const resolver = async (name: string, rr: string) => {
  if (rr === "TXT" && /^sel\._domainkey\.(upwork|paypal)\.com$/.test(name)) return [[`v=DKIM1; k=rsa; p=${PUB_B64}`]];
  const err = new Error("not found") as Error & { code: string };
  err.code = "ENOTFOUND";
  throw err;
};

function rawEmail(from: string, subject: string, body: string, date = "Tue, 15 Sep 2026 10:00:00 +0000", extraHeaders = "") {
  return `${extraHeaders}From: ${from}\r\nTo: nino@example.com\r\nSubject: ${subject}\r\nDate: ${date}\r\nMessage-ID: <${Math.random()}@x>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;
}
async function signed(domain: string, msg: string) {
  const r = await dkimSign(msg, { signatureData: [{ signingDomain: domain, selector: "sel", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) }] });
  return r.signatures + msg;
}

describe("email signature check", () => {
  it("accepts a genuine DKIM-signed Upwork email", async () => {
    const msg = await signed("upwork.com", rawEmail("Upwork <donotreply@upwork.com>", "You've received a payment", "Bloom Ltd paid you $800.00 for Mobile app design."));
    const v = await verifyPaymentEmail(Buffer.from(msg), { resolver });
    expect(v.trust).toBe("dkim");
  });

  it("rejects an edited amount", async () => {
    const msg = await signed("upwork.com", rawEmail("Upwork <donotreply@upwork.com>", "You've received a payment", "Bloom Ltd paid you $800.00."));
    const v = await verifyPaymentEmail(Buffer.from(msg.replace("$800.00", "$8000.00")), { resolver });
    expect(v.trust).toBe("failed");
  });

  it("rejects a forged sender and unknown senders", async () => {
    const forged = await signed("evil.com", rawEmail("PayPal <service@paypal.com>", "You've got money", "$5,000.00"));
    expect((await verifyPaymentEmail(Buffer.from(forged), { resolver })).trust).toBe("failed");
    const other = await signed("upwork.com", rawEmail("Friend <a@gmail.com>", "hi", "$5"));
    expect((await verifyPaymentEmail(Buffer.from(other), { resolver })).trust).toBe("failed");
  });

  it("accepts Google's delivery stamp for old emails, only from mx.google.com", async () => {
    const stamp = "Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@paypal.com header.s=pp-dkim1;\r\n       spf=pass\r\n";
    const ok = rawEmail("PayPal <service@paypal.com>", "You've got money", "Lasha K. sent you $300.00 USD", undefined, stamp);
    expect((await verifyPaymentEmail(Buffer.from(ok), { resolver })).trust).toBe("google-stamp");
    const fake = rawEmail("PayPal <service@paypal.com>", "You've got money", "x", undefined, "Authentication-Results: evil.example; dkim=pass header.i=@paypal.com\r\n");
    expect((await verifyPaymentEmail(Buffer.from(fake), { resolver })).trust).toBe("failed");
  });
});

describe("email reading rules", () => {
  it("finds amount, kind and payer", () => {
    expect(findAmount("Lasha K. sent you $1,250.50 USD")).toEqual({ amount: 1250.5, currency: "USD" });
    expect(findAmount("You received 300.00 EUR")).toEqual({ amount: 300, currency: "EUR" });
    expect(classifyByRules("You've got money", "Lasha K. sent you $300")).toBe("client_payment");
    expect(classifyByRules("Your withdrawal is on its way", "$500 to your bank")).toBe("platform_payout");
    expect(classifyByRules("Invoice sent to Bloom", "Invoice #12 for $800")).toBe("invoice");
    expect(findPayer("You've got money", "Lasha K. sent you $300.00", "PayPal", "client_payment")).toBe("Lasha K.");
    expect(findPayer("Payment received", "You received a payment from Bloom Ltd for Mobile app.", "Upwork", "client_payment")).toBe("Bloom Ltd");
  });
});

describe("cross-source reconciliation", () => {
  const base = { asset: "USD", payerLabel: null, note: null, proof: "x" } as const;
  const p = (o: Partial<PaymentFact> & Pick<PaymentFact, "at" | "source" | "amountUsd" | "payer" | "chain">): PaymentFact => ({ ...base, status: "income", ...o });

  it("counts a payment seen in Upwork email and in the bank once, and bank payouts from platforms once", () => {
    const out = reconcilePayments([
      p({ at: "2026-09-01T10:00:00Z", source: "email", amountUsd: 800, payer: "Bloom Ltd", chain: "Upwork" }),
      p({ at: "2026-09-04T10:00:00Z", source: "bank", amountUsd: 790, payer: "Bloom Ltd", chain: "TBC Bank statement" }),
      p({ at: "2026-09-10T10:00:00Z", source: "bank", amountUsd: 1500, payer: "UPWORK GLOBAL INC", chain: "TBC Bank statement" }),
      p({ at: "2026-09-20T10:00:00Z", source: "bank", amountUsd: 400, payer: "Kavea LLC", chain: "TBC Bank statement" }),
    ]);
    expect(out.map((x) => x.status)).toEqual(["income", "duplicate", "own_transfer", "income"]);
  });

  it("keeps platform payouts as income when the platform itself isn't connected", () => {
    const out = reconcilePayments([p({ at: "2026-09-10T10:00:00Z", source: "bank", amountUsd: 1500, payer: "PayPal Europe", chain: "TBC" })]);
    expect(out[0].status).toBe("income");
    expect(out[0].note).toMatch(/isn't visible/);
  });

  it("matches clients between work and payments", () => {
    const m = matchClients([p({ at: "2026-09-01T10:00:00Z", source: "email", amountUsd: 800, payer: "Bloom Ltd", chain: "Upwork" })], [{ at: "2026-08-01T10:00:00Z", source: "figma", kind: "comment", item: "Bloom banking app", person: "Bloom PM" }]);
    expect(m).toHaveLength(1);
  });

  it("matches names across scripts", () => {
    expect(nameTokens("ნინო ბერიძე")).toEqual(["nino", "beridze"]);
    expect(samePerson("ნინო ბერიძე", "BERIDZE NINO")).toBe(true);
    expect(samePerson("Nino Beridze", "Nino Kapanadze")).toBe(false);
  });
});

/* ---------- ID check ---------- */

function td1(o: { doc: string; dob: string; exp: string; pn: string; sur: string; given: string }) {
  const l1 = `IDGEO${o.doc}${mrzCheckDigit(o.doc)}${o.pn.padEnd(15, "<")}`;
  const l2a = `${o.dob}${mrzCheckDigit(o.dob)}F${o.exp}${mrzCheckDigit(o.exp)}GEO`;
  const l2 = `${l2a}${"<".repeat(11)}`;
  const comp = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const l3 = `${o.sur}<<${o.given}`.padEnd(30, "<");
  return [l1, l2 + mrzCheckDigit(comp), l3].join("\n");
}

describe("ID check", () => {
  const good = td1({ doc: "12ID34567", dob: "950314", exp: "310101", pn: "01001012345", sur: "BERIDZE", given: "NINO" });

  it("parses a Georgian ID card code and validates every check digit", () => {
    const m = parseMrz(good)!;
    expect(m.format).toBe("TD1");
    expect(m.surname).toBe("BERIDZE");
    expect(m.personalNumber).toBe("01001012345");
    expect(m.checks.every((c) => c.ok)).toBe(true);
    expect(parseMrz(good.replace("950314", "950315"))!.checks.some((c) => !c.ok)).toBe(true);
  });

  it("accepts a passport (2 lines of 44) with all its check digits", () => {
    const doc = "13AB45678";
    const dob = "950314";
    const exp = "320520";
    const pn = "01001012345<<<";
    const l1 = "P<GEOBERIDZE<<NINO".padEnd(44, "<");
    const pnCheck = mrzCheckDigit(pn);
    const head = `${doc}${mrzCheckDigit(doc)}GEO${dob}${mrzCheckDigit(dob)}F${exp}${mrzCheckDigit(exp)}${pn}${pnCheck}`;
    const comp = head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 43);
    const l2 = head + mrzCheckDigit(comp);
    const m = parseMrz(`${l1}\n${l2}`)!;
    expect(m.format).toBe("TD3");
    expect(m.checks.every((c) => c.ok)).toBe(true);
    const r = evaluateId({ mrz: `${l1}\n${l2}`, liveness: { blink: true, turn: true }, faceSimilarity: 0.7 }, { accountName: "Nino Beridze", holderNames: [], now: NOW });
    expect(r.status).toBe("verified");
    expect(r.checks[0].detail).toContain("Passport");
  });

  it("verifies only when every check passes", () => {
    const ctx = { accountName: "Nino Beridze", holderNames: [], now: NOW };
    expect(evaluateId({ mrz: good, liveness: { blink: true, turn: true }, faceSimilarity: 0.8 }, ctx).status).toBe("verified");
    expect(evaluateId({ mrz: good, liveness: { blink: false, turn: true }, faceSimilarity: 0.8 }, ctx).status).toBe("failed");
    expect(evaluateId({ mrz: good, liveness: { blink: true, turn: true }, faceSimilarity: 0.3 }, ctx).status).toBe("failed");
    expect(evaluateId({ mrz: good, liveness: { blink: true, turn: true }, faceSimilarity: 0.8 }, { ...ctx, accountName: "Giorgi Maisuradze" }).status).toBe("failed");
  });
});

/* ---------- bank test file ---------- */

describe("TBC test import", () => {
  it("reads CSV credits and Berlin-Group JSON", () => {
    const csv = parseBankFile("tbc.csv", "Date;Amount;Currency;Counterparty;Description\n2026-09-03;2150.00;GEL;Bloom LLC;Design services\n2026-09-05;-45.00;GEL;Magti;Phone\n");
    expect(csv.payments).toHaveLength(1);
    expect(csv.payments[0].payer).toBe("Bloom LLC");
    expect(csv.payments[0].amountUsd).toBeCloseTo(795.5, 0);
    const json = parseBankFile("tbc.json", JSON.stringify({ account: { ownerName: "Nino Beridze" }, transactions: { booked: [{ transactionId: "t1", bookingDate: "2026-09-03", transactionAmount: { amount: "1000.00", currency: "GEL" }, debtorName: "Kavea LLC" }] } }));
    expect(json.holderName).toBe("Nino Beridze");
    expect(json.payments[0].extId).toBe("bank:t1");
  });
});

/* ---------- end to end: Gmail, Wise, Canva, Webflow, Miro, Dribbble ---------- */

describe("beta sources end to end", () => {
  const ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET", "MIRO_CLIENT_ID", "MIRO_CLIENT_SECRET", "DRIBBBLE_CLIENT_ID", "DRIBBBLE_CLIENT_SECRET"];
  beforeEach(() => ENV.forEach((k) => (process.env[k] = `test-${k.toLowerCase()}`)));
  afterEach(() => ENV.forEach((k) => delete process.env[k]));

  async function setup() {
    const upwork = await signed("upwork.com", rawEmail("Upwork <donotreply@upwork.com>", "You've received a payment", "You received a payment from Bloom Ltd for Mobile app design. Amount: $800.00", "Tue, 01 Sep 2026 10:00:00 +0000"));
    const payout = await signed("paypal.com", rawEmail("PayPal <service@paypal.com>", "Your withdrawal is on its way", "$500.00 USD is on its way to your bank", "Thu, 10 Sep 2026 10:00:00 +0000"));
    const forged = rawEmail("PayPal <service@paypal.com>", "You've got money", "Rich Client sent you $9,000.00 USD");
    const mails: Record<string, string> = { m1: upwork, m2: payout, m3: forged };
    const calls: string[] = [];
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "https://oauth2.googleapis.com/token") return ok({ access_token: "g-access", refresh_token: "g-refresh", expires_in: 3600 });
      if (url.endsWith("/users/me/profile") && url.includes("gmail")) return ok({ emailAddress: "nino@example.com" });
      if (url.includes("gmail.googleapis.com") && url.includes("/messages?")) return ok({ messages: [{ id: "m1" }, { id: "m2" }, { id: "m3" }] });
      const mm = url.match(/messages\/(m\d)\?format=raw/);
      if (mm) return ok({ id: mm[1], internalDate: String(Date.parse("2026-09-15")), raw: Buffer.from(mails[mm[1]]).toString("base64url") });
      if (url === "https://api.wise.com/v2/profiles") return ok([{ id: 1, type: "PERSONAL", fullName: "Nino Beridze" }]);
      if (url.includes("/v4/profiles/1/balances")) return ok([{ id: 9, currency: "EUR" }]);
      if (url.includes("/balance-statements/9/statement.json"))
        return ok({ transactions: [
          { type: "CREDIT", date: "2026-08-20T10:00:00Z", amount: { value: 600, currency: "EUR" }, details: { type: "DEPOSIT", senderName: "Kavea GmbH" }, referenceNumber: "W1" },
          { type: "CREDIT", date: "2026-08-22T10:00:00Z", amount: { value: 100, currency: "EUR" }, details: { type: "MONEY_ADDED" }, referenceNumber: "W2" },
          { type: "DEBIT", date: "2026-08-23T10:00:00Z", amount: { value: -50, currency: "EUR" }, details: { type: "CARD" }, referenceNumber: "W3" },
        ] });
      if (url === "https://api.canva.com/rest/v1/oauth/token") return ok({ access_token: "c-access", expires_in: 14400, refresh_token: "c-r" });
      if (url.endsWith("/users/me/profile")) return ok({ profile: { display_name: "Nino B" } });
      if (url.startsWith("https://api.canva.com/rest/v1/designs")) return ok({ items: [{ id: "D1", title: "Bloom social posts", created_at: 1756000000, updated_at: 1757000000 }] });
      if (url === "https://api.miro.com/v1/oauth/token") return ok({ access_token: "mi-access" });
      if (url === "https://api.miro.com/v1/oauth-token") return ok({ user: { id: "7", name: "Nino B" }, team: { name: "Studio" } });
      if (url.startsWith("https://api.miro.com/v2/boards?")) return ok({ data: [{ id: "B1", name: "Bloom discovery", createdAt: "2026-07-01T10:00:00Z", modifiedAt: "2026-09-01T10:00:00Z" }] });
      if (url.includes("/boards/B1/items")) return ok({ data: [{ id: "i1", createdAt: "2026-07-02T10:00:00Z", modifiedAt: "2026-07-05T10:00:00Z", createdBy: { id: "7" }, modifiedBy: { id: "7" } }] });
      if (url.includes("/boards/B1/members")) return ok({ data: [{ id: "7", name: "Nino B" }, { id: "8", name: "Bloom PM" }] });
      if (url === "https://dribbble.com/oauth/token") return ok({ access_token: "d-access" });
      if (url === "https://api.dribbble.com/v2/user") return ok({ name: "Nino Beridze", login: "ninob", created_at: "2019-03-01T00:00:00Z" });
      if (url.startsWith("https://api.dribbble.com/v2/user/shots")) return ok([{ id: 1, title: "Bloom app", published_at: "2026-06-01T00:00:00Z" }]);
      if (url === "https://api.webflow.com/v2/token/authorized_by") return new Response("{}", { status: 403 });
      if (url === "https://api.webflow.com/v2/sites") return ok({ sites: [{ id: "S1", displayName: "Bloom site", createdOn: "2026-05-01T00:00:00Z", lastPublished: "2026-09-01T00:00:00Z", customDomains: [{ url: "bloom.ge" }] }] });
      if (url.includes("/sites/S1/pages")) return ok({ pages: [{ id: "P1", title: "Home", lastUpdated: "2026-08-30T00:00:00Z" }] });
      return new Response("not found " + url, { status: 404 });
    }) as typeof fetch;
    const store = createBetaStore(openDatabase(":memory:"));
    const service = createBetaService({ store, vault: createVault(Buffer.alloc(32, 3)), fetch: f, now: () => NOW, dnsResolver: resolver });
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
    const oauth = async (p: string) => {
      const start = await call<{ url: string }>("POST", `oauth/${p}/start`, {});
      expect(start.status).toBe(200);
      const state = new URL(start.body.url).searchParams.get("state")!;
      const cb = await call("GET", `oauth/${p}/callback?state=${state}&code=abc`);
      expect(cb.status).toBe(302);
      expect(cb.location).toContain("/beta?connected=");
      await service.idle();
      return new URL(start.body.url);
    };
    return { call, service, me, calls, oauth };
  }

  it("connects every source, verifies emails, dedupes, matches clients and scores", async () => {
    const { call, service, me, calls, oauth } = await setup();
    const g = await oauth("google");
    expect(g.searchParams.get("code_challenge_method")).toBe("S256");
    expect(g.searchParams.get("scope")).toContain("gmail.readonly");
    const c = await oauth("canva");
    expect(c.searchParams.get("code_challenge")).toBeTruthy();
    await oauth("miro");
    await oauth("dribbble");
    expect((await call("POST", "wise/token", { token: "wise-read-only-token-0123456789" })).status).toBe(201);
    expect((await call("POST", "webflow/token", { token: "webflow-site-token-0123456789abc" })).status).toBe(201);
    await service.idle();
    expect(calls.some((x) => x.startsWith("GET https://gmail.googleapis.com/gmail/v1/users/me/messages?") && decodeURIComponent(x).includes("from:(upwork.com OR fiverr.com OR paypal.com OR payoneer.com)"))).toBe(true);

    const conns = (await call<{ provider: string; status: string; label: string; lastError: string | null }[]>("GET", "connections")).body;
    expect(conns.map((x) => [x.provider, x.status, x.lastError])).toEqual([
      ["gmail", "ok", null], ["canva", "ok", null], ["miro", "ok", null], ["dribbble", "ok", null], ["wise", "ok", null], ["webflow", "ok", null],
    ]);

    const pays = service.payments(me);
    const upwork = pays.find((p) => p.chain === "Upwork")!;
    expect(upwork).toMatchObject({ status: "income", amountUsd: 800, payer: "Bloom Ltd" });
    expect(upwork.proof).toMatch(/DKIM signature valid/);
    expect(pays.find((p) => p.chain === "PayPal")!.status).toBe("not_income");
    expect(pays.some((p) => p.amountUsd === 9000)).toBe(false);
    expect(pays.find((p) => p.payer === "Kavea GmbH")).toMatchObject({ status: "income", amountUsd: 660 });
    expect(pays.find((p) => p.proof.includes("W2"))!.status).toBe("own_transfer");

    // TBC test file: a deposit equal to the Upwork payment, a payout from Upwork, and a new client
    const imp = await call("POST", "bank/import", { filename: "tbc-test.csv", content: "date,amount,currency,counterparty\n2026-09-03,2160.00,GEL,Bloom Ltd\n2026-09-12,1300.00,GEL,UPWORK ESCROW INC\n2026-09-20,1000.00,GEL,Kavea LLC\n" });
    expect(imp.status).toBe(201);
    const after = service.payments(me);
    const bank = after.filter((p) => p.source === "bank");
    expect(bank.find((p) => p.payer === "Bloom Ltd")!.status).toBe("duplicate");
    expect(bank.find((p) => p.payer === "UPWORK ESCROW INC")!.status).toBe("own_transfer");
    expect(bank.find((p) => p.payer === "Kavea LLC")!.status).toBe("income");

    const s = service.score(me);
    expect(s.ready).toBe(true);
    expect(s.reasons.map((r) => r.id)).toContain("client_match");
    expect(s.features.workTools).toBeGreaterThanOrEqual(4);

    const tl = (await call<{ text: string }[]>("GET", "timeline")).body.map((e) => e.text).join("\n");
    expect(tl).toMatch(/1 email failed the signature check/);
    expect(tl).toMatch(/Gmail account: nino@example.com/);
    expect(tl).toMatch(/Canva account: Nino B/);
    expect(tl).toMatch(/1 on a client's own domain/);
  });

  it("verifies ID through the API and flags a payout account in someone else's name", async () => {
    const { call, service, me } = await setup();
    await call("POST", "bank/import", { filename: "tbc.json", content: JSON.stringify({ account: { ownerName: "Giorgi Maisuradze" }, transactions: { booked: [{ transactionId: "t1", bookingDate: "2026-09-03", transactionAmount: { amount: "3000", currency: "GEL" }, debtorName: "Kavea LLC" }] } }) });
    const mrz = td1({ doc: "12ID34567", dob: "950314", exp: "310101", pn: "01001012345", sur: "BERIDZE", given: "NINO" });
    const r = await call<{ identity: { status: string; checks: { id: string; ok: boolean }[] } }>("POST", "identity", { mrz, liveness: { blink: true, turn: true }, faceSimilarity: 0.81 });
    expect(r.body.identity.checks.find((c) => c.id === "holder_TBC Bank statement")!.ok).toBe(false);
    expect(r.body.identity.status).toBe("failed");
    expect(service.identity(me)!.status).toBe("failed");
  });

  it("uses the browser's address when PUBLIC_URL is present but empty (copied .env.example)", async () => {
    process.env.PUBLIC_URL = "";
    try {
      const { call } = await setup();
      const r = await call<{ url: string }>("POST", "oauth/google/start", {});
      expect(new URL(r.body.url).searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/beta/oauth/google/callback");
    } finally {
      delete process.env.PUBLIC_URL;
    }
  });

  it("explains when a provider app isn't configured", async () => {
    const { call } = await setup();
    delete process.env.CANVA_CLIENT_ID;
    const r = await call<{ error: string }>("POST", "oauth/canva/start", {});
    expect(r.status).toBe(501);
    expect(r.body.error).toContain("CANVA_CLIENT_ID");
  });
});
