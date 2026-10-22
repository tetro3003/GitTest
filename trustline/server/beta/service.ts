import { randomInt } from "node:crypto";
import { computeBetaScore } from "@/lib/beta/score";
import type { BetaScore, BetaUser, ChainFamily, PaymentFact, WalletChallenge } from "@/lib/beta/types";
import { checkPassword, hashPassword, newId, newToken } from "./auth";
import { exchangeFigmaCode, figmaAuthorizeUrl, figmaOAuthConfigured, figmaWhoAmI, ProviderError, readFigmaWork, refreshFigmaIfNeeded, type FigmaSecret } from "./providers/figma";
import { classifyPayment, normalizeAddress, readWalletPayments, verifyWalletSignature, walletChallengeMessage } from "./providers/wallets";
import { startRun, type BetaStore, type Run, type StoredConnection } from "./store";
import type { Vault } from "./vault";

export { ProviderError };

type Fetch = typeof fetch;
const FAMILY_NAME: Record<ChainFamily, string> = { evm: "Ethereum & EVM chains", solana: "Solana", tron: "Tron" };
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function createBetaService(deps: { store: BetaStore; vault: Vault; fetch?: Fetch; now?: () => Date }) {
  const { store, vault } = deps;
  const f: Fetch = deps.fetch ?? ((...a) => fetch(...a));
  const now = deps.now ?? (() => new Date());

  /* ---------- accounts ---------- */

  function signup(input: { email: string; name: string; password: string }): { user: BetaUser; token: string } {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProviderError("Enter a valid email address");
    if (input.name.trim().length < 2) throw new ProviderError("Enter your full name");
    if (input.password.length < 8) throw new ProviderError("Password must be at least 8 characters");
    if (store.userByEmail(email)) throw new ProviderError("An account with this email already exists. Log in instead.", 409);
    const user = store.createUser({ email, name: input.name.trim(), passwordHash: hashPassword(input.password) });
    const run = startRun(store, user.id, null);
    run.ok("you", `Account created for ${user.name}`, "Password stored as a scrypt hash: even we can't read it");
    return { user, token: store.createSession(user.id) };
  }

  function login(email: string, password: string): { user: BetaUser; token: string } {
    const u = store.userByEmail(email.trim());
    if (!u || !checkPassword(password, u.passwordHash)) throw new ProviderError("Wrong email or password", 401);
    const user: BetaUser = { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
    return { user, token: store.createSession(user.id) };
  }

  /* ---------- scoring ---------- */

  function ownAddresses(userId: string): Set<string> {
    return new Set(
      store
        .connections(userId)
        .filter((c) => c.provider === "wallet")
        .map((c) => String(c.settings.address).toLowerCase()),
    );
  }

  /** Payments with their status re-decided against every wallet the person owns today. */
  function payments(userId: string): PaymentFact[] {
    const own = ownAddresses(userId);
    return store.payments(userId).map((p) => ({ ...p, ...classifyPayment(p, own) }));
  }

  function rescore(userId: string, run: Run): BetaScore {
    const pays = payments(userId);
    const work = store.work(userId);
    const income = pays.filter((p) => p.status === "income").length;
    run.step("trustline", `Recalculating your score from ${income} verified payment${income === 1 ? "" : "s"} and ${work.length} work fact${work.length === 1 ? "" : "s"}`, "Own transfers, exchange withdrawals and dust are left out");
    const before = store.latestScore(userId);
    const report = computeBetaScore({ payments: pays, work, asOf: now().toISOString() });
    store.saveScore(userId, report);
    if (!report.ready) run.warn("trustline", `Not enough proof for a score yet: ${report.missing[0]}`);
    else {
      const prev = before?.score;
      run.ok("trustline", prev != null && prev !== report.score ? `Score updated ${prev} → ${report.score} (band ${report.band})` : `Score ${report.score} (band ${report.band}) · verified income $${report.verifiedMonthlyIncome.toLocaleString("en-US")}/month`);
      for (const fl of report.flags) run.warn("trustline", `Warning: ${fl.title}. ${fl.detail}`);
    }
    return report;
  }

  function score(userId: string): BetaScore {
    return store.latestScore(userId) ?? computeBetaScore({ payments: payments(userId), work: store.work(userId), asOf: now().toISOString() });
  }

  /* ---------- syncing ---------- */

  async function syncFigma(c: StoredConnection, run: Run) {
    if (!c.secret) throw new ProviderError("Figma isn't signed in yet");
    run.step("trustline", "Unlocking your Figma key from the vault", "AES-256-GCM decrypt with the server's master key");
    let secret = JSON.parse(vault.open(c.secret)) as FigmaSecret;
    const fresh = await refreshFigmaIfNeeded(secret, run, f);
    if (fresh) {
      secret = fresh;
      store.updateConnection(c.id, { secret: vault.seal(JSON.stringify(secret)) });
    }
    const files = (c.settings.files as string[] | undefined) ?? [];
    if (!files.length) {
      run.warn("trustline", "No files chosen yet. Add the Figma files that hold client work.");
      store.updateConnection(c.id, { status: "needs_setup" });
      return false;
    }
    const { account, facts } = await readFigmaWork(secret, files, run, f);
    const added = store.addWork(c.userId, c.id, facts);
    run.ok("trustline", `${added} new work fact${added === 1 ? "" : "s"} saved${facts.length - added ? `, ${facts.length - added} already known` : ""}`, "Stored: date, file name, commenter. The designs themselves are never copied.");
    store.updateConnection(c.id, { label: `Figma · ${account.handle}` });
    return true;
  }

  async function syncWallet(c: StoredConnection, run: Run) {
    const family = c.settings.family as ChainFamily;
    const address = String(c.settings.address);
    const raw = await readWalletPayments(family, address, run, f);
    const own = ownAddresses(c.userId);
    const classified = raw.map((p) => ({ ...p, ...classifyPayment(p, own) }));
    const added = store.addPayments(c.userId, c.id, classified);
    const count = (s: string) => classified.filter((p) => p.status === s).length;
    const total = classified.filter((p) => p.status === "income").reduce((a, p) => a + p.amountUsd, 0);
    run.ok("trustline", `${count("income")} payments count as income ($${Math.round(total).toLocaleString("en-US")}); ${added} new since last check`);
    if (count("own_transfer")) run.step("trustline", `${count("own_transfer")} transfer(s) came from your own wallets: not counted twice`);
    if (count("unclear")) run.warn("trustline", `${count("unclear")} transfer(s) came from an exchange: could be your own money, not counted`);
    if (count("ignored")) run.step("trustline", `${count("ignored")} tiny transfer(s) ignored: dust or address-poisoning spam`);
    return true;
  }

  const running = new Set<string>();
  const inflight = new Set<Promise<void>>();
  const spawn = (p: Promise<void>) => {
    inflight.add(p);
    void p.finally(() => inflight.delete(p));
  };

  /** Refreshes one connection end to end and rescores. Every step lands in the timeline. */
  async function sync(c: StoredConnection, trigger: "you" | "robot", run: Run = startRun(store, c.userId, c.id)): Promise<void> {
    if (running.has(c.id)) return;
    running.add(c.id);
    store.updateConnection(c.id, { status: "syncing" });
    run.step(trigger, trigger === "robot" ? `Daily robot: refreshing ${c.label}` : `Refreshing ${c.label}`);
    try {
      const ready = c.provider === "figma" ? await syncFigma(c, run) : await syncWallet(c, run);
      if (!ready) return;
      store.updateConnection(c.id, { status: "ok", lastSyncAt: now().toISOString(), lastError: null });
      rescore(c.userId, run);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      run.error("trustline", `Refresh failed: ${msg}`);
      store.updateConnection(c.id, { status: "error", lastSyncAt: now().toISOString(), lastError: msg });
    } finally {
      running.delete(c.id);
    }
  }

  function requireConnection(userId: string, id: string): StoredConnection {
    const c = store.connection(userId, id);
    if (!c) throw new ProviderError("Connection not found", 404);
    return c;
  }

  /* ---------- Figma ---------- */

  function figmaStart(userId: string, redirectUri: string): { url: string } {
    if (!figmaOAuthConfigured()) throw new ProviderError("Sign in with Figma isn't set up on this server yet. Use a personal access token instead.", 501);
    const state = newToken(18);
    store.saveOAuthState(state, userId, "figma");
    const run = startRun(store, userId, null);
    run.step("you", "Clicked “Sign in with Figma”");
    run.step("trustline", "Sending you to figma.com to approve read-only access", `Scopes asked: versions, comments, file names. One-time state code ${state.slice(0, 6)}… blocks hijacking.`);
    return { url: figmaAuthorizeUrl(state, redirectUri) };
  }

  async function figmaCallback(params: { state: string; code: string | null; error: string | null; redirectUri: string }): Promise<{ userId: string; connectionId: string | null; error: string | null }> {
    const st = store.takeOAuthState(params.state);
    if (!st || st.provider !== "figma") return { userId: "", connectionId: null, error: "This sign-in link expired. Please try again." };
    const run = startRun(store, st.userId, null);
    if (params.error || !params.code) {
      run.warn("you", "Figma sign-in was cancelled");
      return { userId: st.userId, connectionId: null, error: "Figma sign-in was cancelled" };
    }
    run.ok("figma", "Figma confirmed you approved access and sent back a one-time code");
    run.step("trustline", "Trading the code for access keys, server to server", "POST https://api.figma.com/v1/oauth/token with our app secret");
    try {
      const secret = await exchangeFigmaCode(params.code, params.redirectUri, f);
      const account = await figmaWhoAmI(secret, run, f);
      const c = store.createConnection({ userId: st.userId, provider: "figma", label: `Figma · ${account.handle}`, status: "needs_setup", secret: vault.seal(JSON.stringify(secret)), settings: { mode: "oauth", files: [] } });
      run.ok("trustline", "Access keys sealed in the vault", "AES-256-GCM; the database only holds ciphertext");
      return { userId: st.userId, connectionId: c.id, error: null };
    } catch (e) {
      run.error("trustline", `Figma sign-in failed: ${(e as Error).message}`);
      return { userId: st.userId, connectionId: null, error: (e as Error).message };
    }
  }

  async function figmaConnectToken(userId: string, token: string) {
    if (token.trim().length < 20) throw new ProviderError("That doesn't look like a Figma personal access token");
    const run = startRun(store, userId, null);
    run.step("you", "Pasted a Figma personal access token");
    const secret: FigmaSecret = { mode: "pat", accessToken: token.trim() };
    const account = await figmaWhoAmI(secret, run, f);
    const c = store.createConnection({ userId, provider: "figma", label: `Figma · ${account.handle}`, status: "needs_setup", secret: vault.seal(JSON.stringify(secret)), settings: { mode: "pat", files: [] } });
    run.ok("trustline", "Token sealed in the vault", "AES-256-GCM; the database only holds ciphertext");
    return c.id;
  }

  async function figmaSetFiles(userId: string, connectionId: string, files: string[]) {
    const c = requireConnection(userId, connectionId);
    if (c.provider !== "figma") throw new ProviderError("Not a Figma connection");
    const clean = [...new Set(files.map((x) => x.trim()).filter(Boolean))].slice(0, 25);
    store.updateConnection(c.id, { settings: { ...c.settings, files: clean }, status: "ok" });
    const run = startRun(store, userId, c.id);
    run.step("you", `Chose ${clean.length} Figma file${clean.length === 1 ? "" : "s"} to count as work`, "Only these files are ever read; everything else stays private");
    spawn(sync(store.connection(userId, c.id)!, "you", run));
  }

  /* ---------- wallets ---------- */

  function walletChallenge(userId: string, family: ChainFamily, rawAddress: string): WalletChallenge {
    if (!["evm", "solana", "tron"].includes(family)) throw new ProviderError("Unknown network");
    const address = normalizeAddress(family, rawAddress);
    if (!address) throw new ProviderError(`That isn't a valid ${FAMILY_NAME[family]} address`);
    if (store.connections(userId).some((c) => c.provider === "wallet" && String(c.settings.address).toLowerCase() === address.toLowerCase())) throw new ProviderError("This wallet is already connected", 409);
    const issued = now().toISOString();
    const message = walletChallengeMessage(address, String(randomInt(100000, 999999)), issued);
    const challengeId = newId("chl");
    const expiresAt = new Date(now().getTime() + 10 * 60_000).toISOString();
    store.saveChallenge({ id: challengeId, userId, family, address, message, expiresAt });
    return { challengeId, message, expiresAt };
  }

  async function walletVerify(userId: string, challengeId: string, signature: string, walletName: string) {
    const ch = store.takeChallenge(challengeId, userId, now().toISOString());
    if (!ch) throw new ProviderError("This signing request expired. Start again.", 410);
    const family = ch.family as ChainFamily;
    const run = startRun(store, userId, null);
    run.step("you", `Signed the ownership message in ${walletName || "a wallet"}`, "No money moved, no fee");
    run.step("trustline", "Checking the signature mathematically", family === "evm" ? "EIP-191 personal_sign, secp256k1 recovery" : family === "solana" ? "Ed25519 signature check" : "TRON signMessageV2, secp256k1 recovery");
    const ok = await verifyWalletSignature(family, ch.address, ch.message, signature);
    if (!ok) {
      run.error("trustline", `Signature doesn't match ${short(ch.address)}. Ownership not proven, wallet not added.`);
      throw new ProviderError("The signature doesn't match this address. Make sure you sign with the same wallet.", 400);
    }
    run.ok("trustline", `Ownership proven: you control ${short(ch.address)}`);
    const name = walletName.trim().slice(0, 40) || FAMILY_NAME[family];
    const c = store.createConnection({ userId, provider: "wallet", label: `${name} · ${short(ch.address)}`, status: "ok", secret: null, settings: { family, address: ch.address, wallet: name, network: FAMILY_NAME[family] } });
    spawn(sync(c, "you", startRun(store, userId, c.id)));
    return c.id;
  }

  /* ---------- misc ---------- */

  function disconnect(userId: string, id: string) {
    const c = requireConnection(userId, id);
    store.deleteConnection(c.id);
    const run = startRun(store, userId, null);
    run.ok("you", `Disconnected ${c.label}. Its key and all facts read from it were deleted.`);
    rescore(userId, run);
  }

  function syncNow(userId: string, id: string) {
    const c = requireConnection(userId, id);
    if (c.status === "needs_setup") throw new ProviderError("Finish setting up this connection first");
    spawn(sync(c, "you"));
  }

  /** Daily robot pass: refreshes everything not synced in the last `maxAgeHours`. */
  async function robotPass(maxAgeHours = 24): Promise<number> {
    const due = store.connectionsDue(new Date(now().getTime() - maxAgeHours * 3600_000).toISOString());
    for (const c of due) await sync(c, "robot");
    return due.length;
  }

  return {
    signup,
    login,
    logout: (token: string) => store.deleteSession(token),
    userForSession: (token: string) => store.userForSession(token),
    connections: (userId: string) => store.connections(userId),
    timeline: (userId: string, afterId?: number) => store.timeline(userId, afterId),
    payments,
    work: (userId: string) => store.work(userId),
    score,
    scoreHistory: (userId: string) => store.scoreHistory(userId),
    figmaOAuthConfigured,
    figmaStart,
    figmaCallback,
    figmaConnectToken,
    figmaSetFiles,
    walletChallenge,
    walletVerify,
    disconnect,
    syncNow,
    robotPass,
    /** Resolves when every background refresh has finished. */
    idle: async () => {
      while (inflight.size) await Promise.all([...inflight]);
    },
    /** For tests: run a sync and wait for it. */
    syncAndWait: (userId: string, id: string) => sync(requireConnection(userId, id), "you"),
  };
}

export type BetaService = ReturnType<typeof createBetaService>;
