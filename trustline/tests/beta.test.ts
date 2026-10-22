import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { computeBetaScore } from "@/lib/beta/score";
import type { PaymentFact, WorkFact } from "@/lib/beta/types";
import { openDatabase } from "@/server/db";
import { createBetaHttp } from "@/server/beta/http";
import { base58Encode, classifyPayment, normalizeAddress, tronFromEvmHex, verifyWalletSignature, walletChallengeMessage } from "@/server/beta/providers/wallets";
import { createBetaService } from "@/server/beta/service";
import { createBetaStore } from "@/server/beta/store";
import { createVault } from "@/server/beta/vault";

const ASOF = "2026-10-15T12:00:00.000Z";
const EVM_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const SECOND_KEY = `0x${"22".repeat(32)}` as const;
const CLIENT = privateKeyToAccount(SECOND_KEY).address.toLowerCase();

function monthsBack(n: number, day = 10) {
  const d = new Date(Date.UTC(2026, 9 - n, day, 12));
  return d.toISOString();
}

function steadyFacts(months = 12, amount = 2000) {
  const payments: PaymentFact[] = [];
  const work: WorkFact[] = [];
  for (let i = 0; i < months; i++) {
    payments.push({ at: monthsBack(i + 1), amountUsd: amount, asset: "USDC", chain: "Base", payer: i % 3 === 0 ? "a" : i % 3 === 1 ? "b" : "c", payerLabel: null, status: "income", note: null, proof: "x" });
    for (let d = 0; d < 6; d++) work.push({ at: monthsBack(i + 1, 2 + d * 4), kind: "version", item: "App", person: null });
  }
  for (let w = 0; w < 12; w++) work.push({ at: new Date(new Date(ASOF).getTime() - w * 7 * 864e5).toISOString(), kind: "version", item: "App", person: null });
  return { payments, work };
}

describe("beta score", () => {
  it("needs income before it scores", () => {
    const r = computeBetaScore({ payments: [], work: [], asOf: ASOF });
    expect(r.ready).toBe(false);
    expect(r.score).toBeNull();
    expect(r.missing.length).toBe(2);
  });

  it("rewards steady, work-backed income", () => {
    const r = computeBetaScore({ ...steadyFacts(), asOf: ASOF });
    expect(r.ready).toBe(true);
    expect(r.verifiedMonthlyIncome).toBe(2000);
    expect(r.score!).toBeGreaterThanOrEqual(740);
    expect(r.band).toBe("A");
    expect(r.flags).toEqual([]);
  });

  it("penalises missing work evidence and caps income without work", () => {
    const { payments } = steadyFacts();
    const noWork = computeBetaScore({ payments, work: [], asOf: ASOF });
    const withWork = computeBetaScore({ ...steadyFacts(), asOf: ASOF });
    expect(noWork.score!).toBeLessThan(withWork.score!);
    const oldWork: WorkFact[] = [{ at: "2024-01-05T10:00:00Z", kind: "version", item: "Old", person: null }];
    const fraud = computeBetaScore({ payments, work: oldWork, asOf: ASOF });
    expect(fraud.flags.map((f) => f.id)).toContain("income_without_work");
    expect(fraud.score!).toBeLessThanOrEqual(599);
  });

  it("ignores payments that are not income", () => {
    const { payments, work } = steadyFacts();
    const extra: PaymentFact = { ...payments[0], amountUsd: 50000, status: "own_transfer" };
    expect(computeBetaScore({ payments: [...payments, extra], work, asOf: ASOF }).verifiedMonthlyIncome).toBe(2000);
  });
});

describe("wallet ownership", () => {
  it("verifies EVM signatures and rejects other wallets", async () => {
    const acct = privateKeyToAccount(EVM_KEY);
    const msg = walletChallengeMessage(acct.address.toLowerCase(), "123456", ASOF);
    const sig = await acct.signMessage({ message: msg });
    expect(await verifyWalletSignature("evm", acct.address.toLowerCase(), msg, sig)).toBe(true);
    expect(await verifyWalletSignature("evm", CLIENT, msg, sig)).toBe(false);
    expect(await verifyWalletSignature("evm", acct.address.toLowerCase(), msg + "x", sig)).toBe(false);
  });

  it("verifies Solana (Ed25519) signatures", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
    const address = base58Encode(raw);
    expect(normalizeAddress("solana", address)).toBe(address);
    const msg = walletChallengeMessage(address, "654321", ASOF);
    const sig = base58Encode(sign(null, Buffer.from(msg), privateKey));
    expect(await verifyWalletSignature("solana", address, msg, sig)).toBe(true);
    expect(await verifyWalletSignature("solana", address, msg.replace("654321", "000000"), sig)).toBe(false);
  });

  it("verifies TronLink signMessageV2 signatures", async () => {
    const acct = privateKeyToAccount(EVM_KEY);
    const address = tronFromEvmHex(acct.address);
    expect(address.startsWith("T")).toBe(true);
    expect(normalizeAddress("tron", address)).toBe(address);
    const msg = walletChallengeMessage(address, "111111", ASOF);
    const bytes = toBytes(msg);
    const hash = keccak256(Buffer.concat([Buffer.from(`\x19TRON Signed Message:\n${bytes.length}`), Buffer.from(bytes)]));
    const sig = await acct.sign({ hash });
    expect(await verifyWalletSignature("tron", address, msg, sig)).toBe(true);
  });

  it("validates addresses", () => {
    expect(normalizeAddress("evm", "0xABC")).toBeNull();
    expect(normalizeAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(normalizeAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u")).toBeNull();
  });

  it("classifies payments", () => {
    const own = new Set(["0xown"]);
    expect(classifyPayment({ amountUsd: 0.01, payer: "x", payerLabel: null }, own).status).toBe("ignored");
    expect(classifyPayment({ amountUsd: 500, payer: "0xOWN", payerLabel: null }, own).status).toBe("own_transfer");
    expect(classifyPayment({ amountUsd: 500, payer: "x", payerLabel: "Binance 14" }, own).status).toBe("unclear");
    expect(classifyPayment({ amountUsd: 500, payer: "x", payerLabel: null }, own).status).toBe("income");
  });
});

describe("vault", () => {
  it("round-trips and detects tampering", () => {
    const v = createVault(Buffer.alloc(32, 7));
    const sealed = v.seal("figma-secret");
    expect(sealed).not.toContain("figma-secret");
    expect(v.open(sealed)).toBe("figma-secret");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered!!!!").toString("base64");
    expect(() => v.open(parts.join("."))).toThrow();
    expect(() => createVault(Buffer.alloc(32, 8)).open(sealed)).toThrow();
  });
});

/* ---------- end to end through the HTTP API with fake outside services ---------- */

function fakeInternet() {
  const me = { id: "fig1", handle: "nino.design", email: "nino@example.com" };
  const versions = Array.from({ length: 40 }, (_, i) => ({ id: `v${i}`, created_at: new Date(new Date(ASOF).getTime() - i * 9 * 864e5).toISOString(), user: { id: i % 5 === 4 ? "other" : "fig1" } }));
  const transfers = Array.from({ length: 12 }, (_, i) => ({
    from: { hash: i % 2 ? CLIENT : "0x00000000000000000000000000000000000c1e02", name: null },
    to: { hash: "" },
    token: { address_hash: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC" },
    total: { value: String(1800 * 1e6), decimals: "6" },
    timestamp: monthsBack(i + 1),
    transaction_hash: `0xtx${i}`,
    log_index: 1,
  }));
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/v1/me")) return ok(me);
    if (/\/v1\/files\/\w+\?depth=1/.test(url)) return ok({ name: "Bloom banking app" });
    if (url.includes("/versions")) return ok({ versions, pagination: {} });
    if (url.includes("/comments")) return ok({ comments: [{ id: "c1", created_at: monthsBack(1), user: { id: "cl", handle: "Bloom PM" } }] });
    if (url.startsWith("https://base.blockscout.com")) {
      const addr = url.split("/addresses/")[1].split("/")[0];
      const fake = { ...transfers[0], token: { address_hash: "0xdeadbeef00000000000000000000000000000000", symbol: "USDC" }, transaction_hash: "0xfake" };
      return ok({ items: [...transfers, fake].map((t) => ({ ...t, to: { hash: addr } })), next_page_params: null });
    }
    if (url.includes("blockscout.com")) return ok({ items: [], next_page_params: null });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

function setup() {
  const db = openDatabase(":memory:");
  const store = createBetaStore(db);
  const net = fakeInternet();
  const service = createBetaService({ store, vault: createVault(Buffer.alloc(32, 1)), fetch: net.f, now: () => new Date(ASOF) });
  const handle = createBetaHttp(service);
  let cookie = "";
  const call = async <T = Record<string, unknown>>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const req = new Request(`http://localhost:3000/api/beta/${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const res = await handle(req, path.split("?")[0].split("/"));
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, body: (res.status === 302 ? {} : await res.json()) as T };
  };
  return { call, service, store, db, net };
}

describe("beta API", () => {
  it("signs up, connects Figma + a wallet, and scores from real-source facts", async () => {
    const { call, service, db } = setup();
    expect((await call("GET", "me")).status).toBe(401);
    expect((await call("POST", "signup", { email: "nino@example.com", name: "Nino Beridze", password: "short" })).status).toBe(400);
    const su = await call("POST", "signup", { email: "Nino@Example.com", name: "Nino Beridze", password: "correct horse" });
    expect(su.status).toBe(201);
    expect((await call("GET", "me")).status).toBe(200);

    // Figma via personal token, then choose a file
    const fig = await call<{ connectionId: string }>("POST", "figma/token", { token: "figd_0123456789abcdefghijklmnop" });
    expect(fig.status).toBe(201);
    const raw = db.prepare("SELECT secret FROM beta_connections WHERE id = ?").get(fig.body.connectionId) as { secret: string };
    expect(raw.secret).not.toContain("figd_");
    await call("POST", `connections/${fig.body.connectionId}/files`, { files: ["https://www.figma.com/design/AbCdEfGhIjKlMn/Bloom"] });
    await service.idle();

    // Wallet: challenge → sign → verify
    const acct = privateKeyToAccount(EVM_KEY);
    const ch = await call<{ challengeId: string; message: string }>("POST", "wallets/challenge", { family: "evm", address: acct.address });
    expect(ch.body.message).toContain(acct.address.toLowerCase());
    const bad = await call("POST", "wallets/verify", { challengeId: ch.body.challengeId, signature: await privateKeyToAccount(`0x${"11".repeat(32)}`).signMessage({ message: ch.body.message }), walletName: "MetaMask" });
    expect(bad.status).toBe(400);
    const ch2 = await call<{ challengeId: string; message: string }>("POST", "wallets/challenge", { family: "evm", address: acct.address });
    const ok = await call("POST", "wallets/verify", { challengeId: ch2.body.challengeId, signature: await acct.signMessage({ message: ch2.body.message }), walletName: "MetaMask" });
    expect(ok.status).toBe(201);
    // A used challenge can't be replayed
    expect((await call("POST", "wallets/verify", { challengeId: ch2.body.challengeId, signature: "0x00", walletName: "x" })).status).toBe(410);
    await service.idle();

    const conns = (await call<{ provider: string; status: string; stats: { payments: number; workItems: number } }[]>("GET", "connections")).body;
    expect(conns.map((c) => c.status)).toEqual(["ok", "ok"]);
    expect(conns[0].stats.workItems).toBeGreaterThan(20);
    expect(conns[1].stats.payments).toBe(12);

    const s = (await call<{ score: { ready: boolean; score: number; verifiedMonthlyIncome: number } }>("GET", "score")).body.score;
    expect(s.ready).toBe(true);
    expect(s.verifiedMonthlyIncome).toBe(1800);
    expect(s.score).toBeGreaterThan(600);

    const tl = (await call<{ text: string }[]>("GET", "timeline")).body.map((e) => e.text).join("\n");
    expect(tl).toMatch(/Ownership proven/);
    expect(tl).toMatch(/ignored 1 fake token/);
    expect(tl).toMatch(/Bloom banking app/);
    expect(tl).toMatch(/Signature doesn't match/);
  });

  it("treats transfers from your other wallets as own money, and disconnect wipes facts", async () => {
    const { call, service } = setup();
    await call("POST", "signup", { email: "a@b.co", name: "Test User", password: "password1" });
    const me = (await call<{ user: { id: string } }>("GET", "me")).body.user.id;
    const addWallet = async (key: `0x${string}`) => {
      const acct = privateKeyToAccount(key);
      const ch = await call<{ challengeId: string; message: string }>("POST", "wallets/challenge", { family: "evm", address: acct.address });
      await call("POST", "wallets/verify", { challengeId: ch.body.challengeId, signature: await acct.signMessage({ message: ch.body.message }), walletName: "MetaMask" });
      await service.idle();
    };
    await addWallet(EVM_KEY);
    expect(service.payments(me).filter((p) => p.status === "income")).toHaveLength(12);
    // Half of those payments came from CLIENT. Once you prove you own CLIENT too, they are your own money.
    await addWallet(SECOND_KEY);
    const pays = service.payments(me);
    expect(pays.filter((p) => p.status === "own_transfer").length).toBeGreaterThanOrEqual(6);
    const conns = (await call<{ id: string }[]>("GET", "connections")).body;
    for (const c of conns) expect((await call("DELETE", `connections/${c.id}`)).status).toBe(200);
    expect(service.payments(me)).toEqual([]);
    expect(service.score(me).ready).toBe(false);
  });

  it("blocks cross-site and non-JSON writes", async () => {
    const { call } = setup();
    expect((await call("POST", "signup", { email: "x@y.co", name: "X Y", password: "password1" }, { origin: "https://evil.example" })).status).toBe(403);
    const req = new Request("http://localhost:3000/api/beta/login", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    const res = await createBetaHttp(createBetaService({ store: createBetaStore(openDatabase(":memory:")), vault: createVault(Buffer.alloc(32, 2)) }))(req, ["login"]);
    expect(res.status).toBe(415);
  });
});
