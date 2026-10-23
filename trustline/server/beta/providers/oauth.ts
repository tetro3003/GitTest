import { createHash, randomBytes } from "node:crypto";
import type { OAuthProvider } from "@/lib/beta/types";
import { DEMO, demoConsentUrl } from "../demo";
import type { Run } from "../store";
import { ProviderError } from "./figma";

/**
 * "Sign in with …" for every provider that uses standard OAuth 2.0.
 * The designer approves on the provider's own site; we receive a one-time code
 * and trade it, server to server, for read-only keys. Passwords never reach us.
 * Each provider needs a developer app; its id and secret come from the env names below.
 */

type Fetch = typeof fetch;

interface OAuthConfig {
  label: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  /** PKCE adds a one-time secret so a stolen code is useless. */
  pkce: false | "S256" | "s256";
  /** How our app proves itself when trading the code: HTTP Basic header, form fields, or URL query (Miro's documented form). */
  clientAuth: "basic" | "body" | "query";
  extra?: Record<string, string>;
  env: { id: string; secret: string };
  /** Where the developer app is created (shown in setup hints). */
  consoleUrl: string;
}

export const OAUTH: Record<OAuthProvider, OAuthConfig> = {
  google: {
    label: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
    pkce: "S256",
    clientAuth: "body",
    extra: { access_type: "offline", prompt: "consent" },
    env: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
  },
  canva: {
    label: "Canva",
    authUrl: "https://www.canva.com/api/oauth/authorize",
    tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
    scopes: "design:meta:read profile:read",
    pkce: "s256",
    clientAuth: "basic",
    env: { id: "CANVA_CLIENT_ID", secret: "CANVA_CLIENT_SECRET" },
    consoleUrl: "https://www.canva.com/developers/integrations",
  },
  webflow: {
    label: "Webflow",
    authUrl: "https://webflow.com/oauth/authorize",
    tokenUrl: "https://api.webflow.com/oauth/access_token",
    scopes: "authorized_user:read sites:read pages:read",
    pkce: false,
    clientAuth: "body",
    env: { id: "WEBFLOW_CLIENT_ID", secret: "WEBFLOW_CLIENT_SECRET" },
    consoleUrl: "https://webflow.com/dashboard/workspace/integrations",
  },
  miro: {
    label: "Miro",
    authUrl: "https://miro.com/oauth/authorize",
    tokenUrl: "https://api.miro.com/v1/oauth/token",
    scopes: "boards:read",
    pkce: false,
    clientAuth: "query",
    env: { id: "MIRO_CLIENT_ID", secret: "MIRO_CLIENT_SECRET" },
    consoleUrl: "https://miro.com/app/settings/user-profile/apps",
  },
  dribbble: {
    label: "Dribbble",
    authUrl: "https://dribbble.com/oauth/authorize",
    tokenUrl: "https://dribbble.com/oauth/token",
    scopes: "public",
    pkce: false,
    clientAuth: "body",
    env: { id: "DRIBBBLE_CLIENT_ID", secret: "DRIBBBLE_CLIENT_SECRET" },
    consoleUrl: "https://dribbble.com/account/applications/new",
  },
};

export interface OAuthSecret {
  /** "oauth" = from sign-in; "token" = a personal/site token the designer pasted. */
  mode: "oauth" | "token";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export const oauthConfigured = (p: OAuthProvider) => !!(process.env[OAUTH[p].env.id] && process.env[OAUTH[p].env.secret]);

const b64url = (b: Buffer) => b.toString("base64url");

/** Builds the provider's consent URL. Returns the PKCE verifier to keep until the callback. */
export function oauthAuthorizeUrl(p: OAuthProvider, state: string, redirectUri: string): { url: string; verifier: string | null } {
  const c = OAUTH[p];
  const q = new URLSearchParams({ response_type: "code", client_id: process.env[c.env.id] ?? "", redirect_uri: redirectUri, state, ...(c.scopes ? { scope: c.scopes } : {}), ...c.extra });
  let verifier: string | null = null;
  if (c.pkce) {
    verifier = b64url(randomBytes(48));
    q.set("code_challenge", b64url(createHash("sha256").update(verifier).digest()));
    q.set("code_challenge_method", c.pkce);
  }
  if (DEMO()) return { url: demoConsentUrl(p, redirectUri, state, c.scopes), verifier };
  return { url: `${c.authUrl}?${q}`, verifier };
}

async function tokenRequest(p: OAuthProvider, params: Record<string, string>, f: Fetch): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const c = OAUTH[p];
  const id = process.env[c.env.id] ?? "";
  const secret = process.env[c.env.secret] ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  const body = new URLSearchParams(params);
  if (c.clientAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  else {
    body.set("client_id", id);
    body.set("client_secret", secret);
  }
  const res = c.clientAuth === "query" ? await f(`${c.tokenUrl}?${body}`, { method: "POST", headers: { Accept: "application/json" } }) : await f(c.tokenUrl, { method: "POST", headers, body });
  if (!res.ok) throw new ProviderError(`${c.label} refused the sign-in (${res.status}). Try connecting again.`, 502);
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token) throw new ProviderError(`${c.label} didn't return an access key`, 502);
  return j as { access_token: string; refresh_token?: string; expires_in?: number };
}

const expiry = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : undefined);

export async function oauthExchange(p: OAuthProvider, code: string, redirectUri: string, verifier: string | null, f: Fetch = fetch): Promise<OAuthSecret> {
  const j = await tokenRequest(p, { grant_type: "authorization_code", code, redirect_uri: redirectUri, ...(verifier ? { code_verifier: verifier } : {}) }, f);
  return { mode: "oauth", accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: expiry(j.expires_in) };
}

/** Returns a renewed secret when the access key expires within 5 minutes, else null. */
export async function oauthRefreshIfNeeded(p: OAuthProvider, s: OAuthSecret, run: Run, f: Fetch = fetch): Promise<OAuthSecret | null> {
  if (s.mode !== "oauth" || !s.expiresAt || new Date(s.expiresAt).getTime() - Date.now() > 5 * 60_000) return null;
  if (!s.refreshToken) throw new ProviderError(`${OAUTH[p].label} access expired. Please connect again.`, 401);
  run.step("trustline", `${OAUTH[p].label} access key expired, asking for a fresh one`, `POST ${OAUTH[p].tokenUrl} (grant_type=refresh_token)`);
  const j = await tokenRequest(p, { grant_type: "refresh_token", refresh_token: s.refreshToken }, f);
  return { ...s, accessToken: j.access_token, refreshToken: j.refresh_token ?? s.refreshToken, expiresAt: expiry(j.expires_in) };
}

/** Small JSON GET helper with friendly errors. */
export function bearerGet(label: string, token: string, f: Fetch, extraHeaders: Record<string, string> = {}) {
  return async <T>(url: string): Promise<T> => {
    const res = await f(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...extraHeaders } });
    if (res.status === 401) throw new ProviderError(`${label} no longer accepts this access. Please connect again.`, 401);
    if (res.status === 403) throw new ProviderError(`${label} refused: the key is missing a permission.`, 403);
    if (res.status === 429) throw new ProviderError(`${label} asked us to slow down. The robot will try again later.`, 429);
    if (!res.ok) throw new ProviderError(`${label} returned an error (${res.status})`, 502);
    return (await res.json()) as T;
  };
}
