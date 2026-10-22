import type { BetaUser, ChainFamily, OAuthProvider } from "@/lib/beta/types";
import { SESSION_DAYS } from "./store";
import { ProviderError, type BetaService } from "./service";

/**
 * Beta HTTP API: /api/beta/*. Takes a Web Request, returns a Web Response,
 * so it runs in a Next.js route handler and directly in tests.
 * Logged-in state is an HttpOnly cookie; state-changing calls must be JSON
 * from our own origin, which blocks cross-site form attacks.
 */
export const COOKIE = "tl_beta";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers });

function cookieFrom(req: Request): string | null {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionCookie(token: string, req: Request, clear = false) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${clear ? "" : encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_DAYS * 86400}${secure}`;
}

const publicOrigin = (req: Request) => process.env.PUBLIC_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {}
  throw new ProviderError("Request body must be a JSON object");
}
const s = (b: Record<string, unknown>, k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");

const attempts = new Map<string, number[]>();
function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const t = Date.now();
  const list = (attempts.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) throw new ProviderError("Too many attempts. Wait a few minutes and try again.", 429);
  list.push(t);
  attempts.set(key, list);
}

export function createBetaHttp(service: BetaService) {
  return async function handle(req: Request, path: string[]): Promise<Response> {
    const route = path.join("/");
    const method = req.method;
    try {
      if (method !== "GET") {
        const origin = req.headers.get("origin");
        if (origin && origin !== new URL(req.url).origin && origin !== process.env.PUBLIC_URL?.replace(/\/$/, "")) throw new ProviderError("Cross-site request blocked", 403);
        if (method === "POST" && !(req.headers.get("content-type") ?? "").includes("application/json")) throw new ProviderError("Send JSON", 415);
      }

      /* ----- public ----- */
      if (method === "POST" && route === "signup") {
        const b = await body(req);
        rateLimit(`signup:${req.headers.get("x-forwarded-for") ?? "local"}`, 20);
        const { user, token } = service.signup({ email: s(b, "email"), name: s(b, "name"), password: s(b, "password") });
        return json({ user }, 201, { "Set-Cookie": sessionCookie(token, req) });
      }
      if (method === "POST" && route === "login") {
        const b = await body(req);
        rateLimit(`login:${s(b, "email").toLowerCase()}`);
        const { user, token } = service.login(s(b, "email"), s(b, "password"));
        return json({ user }, 200, { "Set-Cookie": sessionCookie(token, req) });
      }
      if (method === "GET" && route === "figma/callback") {
        const q = new URL(req.url).searchParams;
        const r = await service.figmaCallback({ state: q.get("state") ?? "", code: q.get("code"), error: q.get("error"), redirectUri: `${publicOrigin(req)}/api/beta/figma/callback` });
        const to = r.connectionId ? `/beta?figma=${r.connectionId}` : `/beta?error=${encodeURIComponent(r.error ?? "Figma sign-in failed")}`;
        return new Response(null, { status: 302, headers: { Location: `${publicOrigin(req)}${to}` } });
      }

      const oauthCb = route.match(/^oauth\/(google|canva|webflow|miro|dribbble)\/callback$/);
      if (method === "GET" && oauthCb) {
        const p = oauthCb[1] as OAuthProvider;
        const q = new URL(req.url).searchParams;
        const r = await service.oauthCallback(p, { state: q.get("state") ?? "", code: q.get("code"), error: q.get("error"), redirectUri: `${publicOrigin(req)}/api/beta/oauth/${p}/callback` });
        const to = r.connectionId ? `/beta?connected=${r.connectionId}` : `/beta?error=${encodeURIComponent(r.error ?? "Sign-in failed")}`;
        return new Response(null, { status: 302, headers: { Location: `${publicOrigin(req)}${to}` } });
      }

      const bankCb = route.match(/^bank-id\/(tbc|bog)\/callback$/);
      if (method === "GET" && bankCb) {
        const r = await service.bankIdentityCallback(bankCb[1] as "tbc" | "bog", new URL(req.url).searchParams.get("state") ?? "");
        const to = r.ok ? "/beta?bankid=ok" : `/beta?error=${encodeURIComponent(r.error ?? "Bank confirmation failed")}`;
        return new Response(null, { status: 302, headers: { Location: `${publicOrigin(req)}${to}` } });
      }

      /* ----- logged in ----- */
      const token = cookieFrom(req);
      const user: BetaUser | null = token ? service.userForSession(token) : null;
      if (!user) throw new ProviderError("Please log in", 401);

      if (method === "POST" && route === "logout") {
        service.logout(token!);
        return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", req, true) });
      }
      if (method === "GET" && route === "me") return json({ user, figmaOAuth: service.figmaOAuthConfigured(), setup: service.setup() });
      if (method === "GET" && route === "identity") return json({ identity: service.identity(user.id), banks: service.bankIdentities(user.id) });
      const bankStart = route.match(/^bank-id\/(tbc|bog)\/start$/);
      if (method === "POST" && bankStart) return json(await service.bankIdentityStart(user.id, bankStart[1] as "tbc" | "bog", publicOrigin(req)));
      if (method === "POST" && route === "identity") {
        const b = await body(req);
        const live = (b.liveness ?? {}) as Record<string, unknown>;
        const sim = typeof b.faceSimilarity === "number" ? b.faceSimilarity : 0;
        return json({ identity: service.verifyIdentity(user.id, { mrz: s(b, "mrz").slice(0, 300), liveness: { blink: live.blink === true, turn: live.turn === true, realScore: typeof live.realScore === "number" ? live.realScore : undefined }, faceSimilarity: Math.max(0, Math.min(1, sim)) }) });
      }
      const oauthStart = route.match(/^oauth\/(google|canva|webflow|miro|dribbble)\/start$/);
      if (method === "POST" && oauthStart) {
        const p = oauthStart[1] as OAuthProvider;
        return json(service.oauthStart(user.id, p, `${publicOrigin(req)}/api/beta/oauth/${p}/callback`));
      }
      if (method === "POST" && (route === "wise/token" || route === "webflow/token")) {
        const b = await body(req);
        return json({ connectionId: service.connectToken(user.id, route.split("/")[0] as "wise" | "webflow", s(b, "token")) }, 201);
      }
      if (method === "POST" && route === "bank/import") {
        const b = await body(req);
        const content = s(b, "content");
        if (content.length > 5_000_000) throw new ProviderError("The file is too big (max 5 MB)", 413);
        return json({ connectionId: service.bankImport(user.id, s(b, "filename"), content) }, 201);
      }
      if (method === "GET" && route === "connections") return json(service.connections(user.id));
      if (method === "GET" && route === "timeline") return json(service.timeline(user.id, Number(new URL(req.url).searchParams.get("after") ?? 0)));
      if (method === "GET" && route === "score") return json({ score: service.score(user.id), history: service.scoreHistory(user.id) });
      if (method === "GET" && route === "payments") return json(service.payments(user.id));

      if (method === "POST" && route === "figma/start") return json(service.figmaStart(user.id, `${publicOrigin(req)}/api/beta/figma/callback`));
      if (method === "POST" && route === "figma/token") {
        const b = await body(req);
        return json({ connectionId: await service.figmaConnectToken(user.id, s(b, "token")) }, 201);
      }
      if (method === "POST" && route === "wallets/challenge") {
        const b = await body(req);
        return json(service.walletChallenge(user.id, s(b, "family") as ChainFamily, s(b, "address")));
      }
      if (method === "POST" && route === "wallets/verify") {
        const b = await body(req);
        return json({ connectionId: await service.walletVerify(user.id, s(b, "challengeId"), s(b, "signature"), s(b, "walletName")) }, 201);
      }

      const m = route.match(/^connections\/([\w-]+)(?:\/(files|sync))?$/);
      if (m) {
        const [, id, action] = m;
        if (method === "DELETE" && !action) {
          service.disconnect(user.id, id);
          return json({ ok: true });
        }
        if (method === "POST" && action === "files") {
          const b = await body(req);
          const files = Array.isArray(b.files) ? b.files.filter((x): x is string => typeof x === "string") : [];
          if (!files.length) throw new ProviderError("Add at least one Figma file link");
          await service.figmaSetFiles(user.id, id, files);
          return json({ ok: true }, 202);
        }
        if (method === "POST" && action === "sync") {
          service.syncNow(user.id, id);
          return json({ ok: true }, 202);
        }
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      if (e instanceof ProviderError) return json({ error: e.message }, e.status);
      console.error("[beta api]", e);
      return json({ error: "Something went wrong on the server" }, 500);
    }
  };
}
