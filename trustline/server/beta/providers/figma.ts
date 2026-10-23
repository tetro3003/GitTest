import { figmaFileKey } from "@/server/connectors/figma";
import { DEMO, demoConsentUrl } from "../demo";
import type { NewWork, Run } from "../store";

/**
 * Figma, read straight from api.figma.com.
 *
 * Two ways in:
 *  - "Sign in with Figma" (OAuth). Needs a Figma developer app: FIGMA_CLIENT_ID +
 *    FIGMA_CLIENT_SECRET. The designer approves on figma.com; we never see the password.
 *  - A personal access token the designer creates in Figma settings, for laptops
 *    where no developer app is set up yet.
 * Either way the token is sealed in the vault and only used for read-only calls.
 */

type Fetch = typeof fetch;
const API = "https://api.figma.com";

export const FIGMA_SCOPES = process.env.FIGMA_SCOPES?.trim() || "current_user:read file_content:read file_versions:read file_comments:read";

export interface FigmaSecret {
  mode: "oauth" | "pat";
  accessToken: string;
  refreshToken?: string;
  /** ISO time the access token stops working (OAuth only). */
  expiresAt?: string;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function figmaOAuthConfigured(): boolean {
  return !!(process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET);
}

export function figmaAuthorizeUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({ client_id: process.env.FIGMA_CLIENT_ID ?? "", redirect_uri: redirectUri, scope: FIGMA_SCOPES, state, response_type: "code" });
  if (DEMO()) return demoConsentUrl("figma", redirectUri, state, FIGMA_SCOPES);
  return `https://www.figma.com/oauth?${q}`;
}

const basicAuth = () => `Basic ${Buffer.from(`${process.env.FIGMA_CLIENT_ID}:${process.env.FIGMA_CLIENT_SECRET}`).toString("base64")}`;

/** Server-to-server: trade the one-time code (plus our app secret) for tokens. */
export async function exchangeFigmaCode(code: string, redirectUri: string, f: Fetch = fetch): Promise<FigmaSecret> {
  const res = await f(`${API}/v1/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ redirect_uri: redirectUri, code, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new ProviderError(`Figma refused the sign-in code (${res.status}). Try connecting again.`, 502);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return { mode: "oauth", accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: new Date(Date.now() + (j.expires_in ?? 90 * 86400) * 1000).toISOString() };
}

/** Returns a fresh secret when the OAuth access token is (nearly) expired, otherwise null. */
export async function refreshFigmaIfNeeded(secret: FigmaSecret, run: Run, f: Fetch = fetch): Promise<FigmaSecret | null> {
  if (secret.mode !== "oauth" || !secret.refreshToken || !secret.expiresAt) return null;
  if (new Date(secret.expiresAt).getTime() - Date.now() > 24 * 3600_000) return null;
  run.step("trustline", "Figma access key is about to expire, asking Figma for a new one", "POST https://api.figma.com/v1/oauth/refresh");
  const res = await f(`${API}/v1/oauth/refresh`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: secret.refreshToken }),
  });
  if (!res.ok) throw new ProviderError("Figma didn't renew access. Please connect Figma again.", 401);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  run.ok("figma", "New access key received and sealed in the vault");
  return { ...secret, accessToken: j.access_token, expiresAt: new Date(Date.now() + (j.expires_in ?? 90 * 86400) * 1000).toISOString() };
}

function client(secret: FigmaSecret, f: Fetch) {
  const headers: Record<string, string> = secret.mode === "oauth" ? { Authorization: `Bearer ${secret.accessToken}` } : { "X-Figma-Token": secret.accessToken };
  return async <T>(path: string): Promise<T> => {
    const res = await f(`${API}${path}`, { headers });
    if (res.status === 401) throw new ProviderError("Figma no longer accepts this access. Please connect Figma again.", 401);
    if (res.status === 403) throw new ProviderError("Figma says this account can't read that file, or the token is missing a permission.", 403);
    if (res.status === 404) throw new ProviderError("Figma couldn't find one of the files. Check the link.", 404);
    if (res.status === 429) throw new ProviderError("Figma asked us to slow down. The robot will try again later.", 429);
    if (!res.ok) throw new ProviderError(`Figma returned an error (${res.status})`, 502);
    return (await res.json()) as T;
  };
}

export interface FigmaAccount {
  id: string;
  handle: string;
  email: string | null;
}

export async function figmaWhoAmI(secret: FigmaSecret, run: Run, f: Fetch = fetch): Promise<FigmaAccount> {
  run.step("trustline", "Asking Figma whose account this is", "GET https://api.figma.com/v1/me");
  const me = await client(secret, f)<{ id: string; handle: string; email?: string }>("/v1/me");
  run.ok("figma", `Figma account: ${me.handle}${me.email ? ` (${me.email})` : ""}`);
  return { id: me.id, handle: me.handle, email: me.email ?? null };
}

interface Version {
  id: string;
  created_at: string;
  user: { id: string; handle?: string };
}
interface Comment {
  id: string;
  created_at: string;
  user: { id: string; handle?: string };
}

/** Reads version history and comments for the chosen files and turns them into work facts. */
export async function readFigmaWork(secret: FigmaSecret, fileLinks: readonly string[], run: Run, f: Fetch = fetch): Promise<{ account: FigmaAccount; facts: NewWork[] }> {
  const get = client(secret, f);
  const account = await figmaWhoAmI(secret, run, f);
  const keys = [...new Set(fileLinks.map(figmaFileKey).filter((k): k is string => !!k))].slice(0, 25);
  if (!keys.length) throw new ProviderError("Add at least one Figma file link first.");

  const facts: NewWork[] = [];
  for (const key of keys) {
    run.step("trustline", `Opening file ${key}`, `GET /v1/files/${key}?depth=1`);
    const file = await get<{ name: string }>(`/v1/files/${key}?depth=1`);

    run.step("trustline", `Reading the version history of “${file.name}”`, `GET /v1/files/${key}/versions (50 per page)`);
    const versions: Version[] = [];
    let path: string | null = `/v1/files/${key}/versions?page_size=50`;
    for (let page = 0; path && page < 10; page++) {
      const r: { versions: Version[]; pagination?: { next_page?: string } } = await get(path);
      versions.push(...r.versions);
      const next = r.pagination?.next_page;
      path = next ? next.replace(/^https:\/\/api\.figma\.com/, "") : null;
    }
    const mine = versions.filter((v) => v.user?.id === account.id);
    const days = new Set(mine.map((v) => v.created_at.slice(0, 10))).size;
    run.ok("figma", `“${file.name}”: ${versions.length} saved versions, ${mine.length} by you, across ${days} day${days === 1 ? "" : "s"}`, "Only versions saved by your account count as your work");
    if (versions.length) {
      const oldest = versions.map((v) => v.created_at).sort()[0];
      const ageDays = (Date.now() - new Date(oldest).getTime()) / 864e5;
      if (ageDays < 32 && versions.length >= 20) run.warn("figma", "History stops about 30 days back. Figma's free plan keeps only 30 days of versions, so the daily robot will build your history up day by day.");
    }
    for (const v of mine) facts.push({ extId: `v:${v.id}`, at: v.created_at, source: "figma", kind: "version", item: file.name, person: null });

    run.step("trustline", `Reading comments on “${file.name}”`, `GET /v1/files/${key}/comments`);
    const { comments } = await get<{ comments: Comment[] }>(`/v1/files/${key}/comments`);
    const others = comments.filter((c) => c.user?.id !== account.id);
    const people = [...new Set(others.map((c) => c.user?.handle ?? "someone"))];
    run.ok("figma", `${comments.length} comments, ${others.length} from other people${people.length ? ` (${people.slice(0, 4).join(", ")}${people.length > 4 ? "…" : ""})` : ""}`, "Comments from other people are a sign of real clients reviewing the work");
    for (const c of others) facts.push({ extId: `c:${c.id}`, at: c.created_at, source: "figma", kind: "comment", item: file.name, person: c.user?.handle ?? null });
  }
  return { account, facts };
}
