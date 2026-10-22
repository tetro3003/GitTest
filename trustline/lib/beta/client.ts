"use client";

import type { BankIdentity, BetaConnection, BetaScore, BetaUser, ChainFamily, IdentityCheck, OAuthProvider, PaymentFact, TimelineEntry, WalletChallenge, WorkFact } from "./types";

export type SetupState = Record<"figma" | OAuthProvider | "ai" | "tbcId" | "bogId", boolean>;

/** Browser client for /api/beta. The session lives in an HttpOnly cookie. */
export class BetaApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/beta/${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new BetaApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const betaApi = {
  me: () => call<{ user: BetaUser; figmaOAuth: boolean; setup: SetupState }>("GET", "me"),
  oauthStart: (p: OAuthProvider) => call<{ url: string }>("POST", `oauth/${p}/start`, {}),
  pasteToken: (p: "wise" | "webflow", token: string) => call<{ connectionId: string }>("POST", `${p}/token`, { token }),
  bankImport: (filename: string, content: string) => call<{ connectionId: string }>("POST", "bank/import", { filename, content }),
  identity: () => call<{ identity: IdentityCheck | null; banks: BankIdentity[] }>("GET", "identity"),
  bankIdentityStart: (bank: "tbc" | "bog") => call<{ url: string }>("POST", `bank-id/${bank}/start`, {}),
  verifyIdentity: (b: { mrz: string; liveness: { blink: boolean; turn: boolean; realScore?: number }; faceSimilarity: number }) => call<{ identity: IdentityCheck }>("POST", "identity", b),
  signup: (b: { email: string; name: string; password: string }) => call<{ user: BetaUser }>("POST", "signup", b),
  login: (b: { email: string; password: string }) => call<{ user: BetaUser }>("POST", "login", b),
  logout: () => call("POST", "logout", {}),
  connections: () => call<BetaConnection[]>("GET", "connections"),
  timeline: (after = 0) => call<TimelineEntry[]>("GET", `timeline?after=${after}`),
  score: () => call<{ score: BetaScore; history: { at: string; score: number | null }[] }>("GET", "score"),
  payments: () => call<PaymentFact[]>("GET", "payments"),
  work: () => call<WorkFact[]>("GET", "work"),
  figmaStart: () => call<{ url: string }>("POST", "figma/start", {}),
  figmaToken: (token: string) => call<{ connectionId: string }>("POST", "figma/token", { token }),
  setFiles: (id: string, files: string[]) => call("POST", `connections/${id}/files`, { files }),
  sync: (id: string) => call("POST", `connections/${id}/sync`, {}),
  disconnect: (id: string) => call("DELETE", `connections/${id}`),
  walletChallenge: (family: ChainFamily, address: string) => call<WalletChallenge>("POST", "wallets/challenge", { family, address }),
  walletVerify: (challengeId: string, signature: string, walletName: string) => call<{ connectionId: string }>("POST", "wallets/verify", { challengeId, signature, walletName }),
};
