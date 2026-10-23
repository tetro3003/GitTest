import { generateKeyPairSync } from "node:crypto";
import { dkimSign } from "mailauth";

/**
 * DEMO MODE (DEMO_MODE=1). Every outside service (Gmail, Figma, Wise, Canva,
 * Webflow, Miro, Dribbble, the bank's open-banking API) is replaced by this
 * local stand-in serving SYNTHETIC data for one persona, Nino Beridze, a
 * freelance designer. Nothing else changes: consent screens, signature checks
 * (the demo emails really are DKIM-signed, one is forged), extraction,
 * de-duplication, scoring and the lender review all run for real. The UI
 * flags demo mode on every screen.
 */

export const DEMO = () => process.env.DEMO_MODE === "1";

/** Turns on every "Connect" button in demo mode, with obviously fake credentials. */
export function enableDemoSettings() {
  for (const p of ["GOOGLE", "CANVA", "WEBFLOW", "MIRO", "DRIBBBLE", "FIGMA"]) {
    process.env[`${p}_CLIENT_ID`] ||= `demo-${p.toLowerCase()}`;
    process.env[`${p}_CLIENT_SECRET`] ||= "demo-secret";
  }
  for (const b of ["TBC", "BOG"]) process.env[`${b}_OB_BASE_URL`] ||= `https://openbanking.${b.toLowerCase()}.demo`;
}

/** Where a demo "Connect" goes instead of the real provider: our own clearly-labelled consent screen. */
export function demoConsentUrl(provider: string, redirectUri: string, state: string, scopes: string): string {
  const back = new URL(redirectUri);
  back.searchParams.set("code", "demo-code");
  back.searchParams.set("state", state);
  const q = new URLSearchParams({ provider, scopes, next: back.toString() });
  return `${new URL(redirectUri).origin}/beta/mock-consent?${q}`;
}

/* ---------- synthetic persona ---------- */

const DAY = 864e5;
const at = (daysAgo: number, hour = 11) => new Date(Math.floor((Date.now() - daysAgo * DAY) / DAY) * DAY + hour * 3600e3).toISOString();
const rfc2822 = (iso: string) => new Date(iso).toUTCString().replace("GMT", "+0000");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PUBLIC_B64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

/** DNS stand-in: answers the DKIM key lookups for the demo signing domains. */
export async function demoResolver(name: string, rr: string): Promise<unknown> {
  if (rr === "TXT" && /^demo\._domainkey\.(upwork|paypal|fiverr|payoneer)\.com$/.test(name)) return [[`v=DKIM1; k=rsa; p=${PUBLIC_B64}`]];
  const e = new Error(`demo DNS has no ${rr} for ${name}`) as Error & { code: string };
  e.code = "ENOTFOUND";
  throw e;
}

function rawEmail(from: string, subject: string, body: string, date: string, extraHeaders = "") {
  return `${extraHeaders}From: ${from}\r\nTo: nino.beridze@gmail.com\r\nSubject: ${subject}\r\nDate: ${rfc2822(date)}\r\nMessage-ID: <${Math.abs(hash(subject + date))}@demo>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

async function signed(domain: string, msg: string) {
  const r = await dkimSign(msg, { signatureData: [{ signingDomain: domain, selector: "demo", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) }] });
  return r.signatures + msg;
}

let mailbox: Promise<{ id: string; internalDate: string; raw: string }[]> | null = null;
function demoMailbox() {
  mailbox ??= (async () => {
    const mails: { id: string; date: string; raw: string }[] = [];
    for (let m = 0; m < 10; m++) {
      const amount = [1450, 1600, 1750][m % 3];
      const date = at(m * 30 + 4);
      mails.push({ id: `up${m}`, date, raw: await signed("upwork.com", rawEmail("Upwork <donotreply@upwork.com>", "You've received a payment", `Hi Nino,\n\nYou received a payment from Bloom Ltd for Mobile app design.\nAmount: $${amount.toLocaleString("en-US")}.00\n\nThe Upwork Team`, date)) });
    }
    for (const d of [20, 80]) {
      const date = at(d);
      mails.push({ id: `pp${d}`, date, raw: await signed("paypal.com", rawEmail("PayPal <service@paypal.com>", "Your withdrawal is on its way", "$900.00 USD is on its way to your bank account ending 1234.", date)) });
    }
    for (const d of [300, 330]) {
      const date = at(d);
      const stamp = "Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@paypal.com header.s=pp-dkim1;\r\n       spf=pass\r\n";
      mails.push({ id: `old${d}`, date, raw: rawEmail("PayPal <service@paypal.com>", "You've got money", "Lasha K. sent you $300.00 USD", date, stamp) });
    }
    const forgedDate = at(9);
    mails.push({ id: "forged", date: forgedDate, raw: rawEmail("PayPal <service@paypal.com>", "You've got money", "Rich Client sent you $9,000.00 USD", forgedDate) });
    return mails.map((m) => ({ id: m.id, internalDate: String(new Date(m.date).getTime()), raw: Buffer.from(m.raw).toString("base64url") }));
  })();
  return mailbox;
}

const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const FIGMA_NAMES = ["Bloom banking app", "Kavea checkout flow", "Tbilisi Coffee menu", "Portfolio 2026"];

function figmaVersions(key: string) {
  const idx = Math.abs(hash(key)) % FIGMA_NAMES.length;
  const out: { id: string; created_at: string; user: { id: string; handle: string } }[] = [];
  for (let d = 1; d < 300; d += idx === 0 ? 2 : 3) for (let k = 0; k < (d % 5 === 0 ? 3 : 1); k++) out.push({ id: `${key}-${d}-${k}`, created_at: at(d, 9 + k), user: d % 11 === 0 ? { id: "fig_other", handle: "Bloom PM" } : { id: "fig_nino", handle: "nino.design" } });
  return { name: FIGMA_NAMES[idx], versions: out.reverse() };
}

/** The stand-in for every outside API the beta calls. */
export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const host = url.hostname;
  const path = url.pathname;
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call

  // OAuth token endpoints of every provider
  if (/oauth.*(token|refresh)|access_token|\/token$/.test(path) && (init?.method ?? "GET") === "POST") return ok({ access_token: `demo-token-${host}`, refresh_token: "demo-refresh", expires_in: 90 * 86400, token_type: "bearer" });

  if (host === "gmail.googleapis.com") {
    const mails = await demoMailbox();
    if (path.endsWith("/profile")) return ok({ emailAddress: "nino.beridze@gmail.com" });
    if (path.endsWith("/messages")) return ok({ messages: mails.map((m) => ({ id: m.id })) });
    const m = mails.find((x) => path.endsWith(`/messages/${x.id}`));
    if (m) return ok(m);
  }

  if (host === "api.figma.com") {
    if (path === "/v1/me") return ok({ id: "fig_nino", handle: "nino.design", email: "nino.beridze@gmail.com" });
    const f = path.match(/^\/v1\/files\/([^/]+)(\/versions|\/comments)?$/);
    if (f) {
      const v = figmaVersions(f[1]);
      if (!f[2]) return ok({ name: v.name });
      if (f[2] === "/versions") return ok({ versions: v.versions, pagination: {} });
      return ok({ comments: Array.from({ length: 9 }, (_, i) => ({ id: `${f[1]}-c${i}`, created_at: at(6 + i * 27), user: i % 3 ? { id: "fig_c1", handle: "Bloom PM" } : { id: "fig_c2", handle: "Lasha K." } })) });
    }
  }

  if (host === "api.wise.com") {
    if (path === "/v2/profiles") return ok([{ id: 101, type: "PERSONAL", fullName: "Nino Beridze" }]);
    if (path.includes("/balances")) return ok([{ id: 7, currency: "EUR" }]);
    if (path.includes("/statement.json"))
      return ok({
        transactions: [
          ...Array.from({ length: 6 }, (_, i) => ({ type: "CREDIT", date: at(i * 60 + 15), amount: { value: 650 + i * 20, currency: "EUR" }, details: { type: "DEPOSIT", senderName: "Kavea GmbH" }, referenceNumber: `TRF-${9000 + i}` })),
          { type: "CREDIT", date: at(40), amount: { value: 200, currency: "EUR" }, details: { type: "MONEY_ADDED" }, referenceNumber: "TOPUP-1" },
        ],
      });
  }

  if (host === "api.canva.com") {
    if (path.endsWith("/users/me/profile")) return ok({ profile: { display_name: "Nino Beridze" } });
    if (path.endsWith("/designs")) return ok({ items: ["Kavea social kit", "Kavea pitch deck", "Coffee menu poster"].map((t, i) => ({ id: `D${i}`, title: t, created_at: unix(at(200 - i * 40)), updated_at: unix(at(10 + i * 7)) })) });
  }

  if (host === "api.webflow.com") {
    if (path.endsWith("/token/authorized_by")) return ok({ firstName: "Nino", lastName: "Beridze", email: "nino.beridze@gmail.com" });
    if (path === "/v2/sites") return ok({ sites: [{ id: "S1", displayName: "Bloom site", createdOn: at(160), lastPublished: at(5), customDomains: [{ url: "bloom.ge" }] }, { id: "S2", displayName: "Portfolio", createdOn: at(250), lastPublished: at(30), customDomains: [] }] });
    const pg = path.match(/\/sites\/(S\d)\/pages/);
    if (pg) return ok({ pages: Array.from({ length: 6 }, (_, i) => ({ id: `${pg[1]}-p${i}`, title: `Page ${i}`, lastUpdated: at(4 + i * 18) })) });
  }

  if (host === "api.miro.com") {
    if (path === "/v1/oauth-token") return ok({ user: { id: "7", name: "Nino Beridze" }, team: { name: "Nino Studio" } });
    if (path === "/v2/boards") return ok({ data: [{ id: "B1", name: "Kavea discovery workshop", createdAt: at(120), modifiedAt: at(12) }] });
    if (path.endsWith("/items")) return ok({ data: Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, createdAt: at(120 - i), modifiedAt: at(12 + i * 9), createdBy: { id: "7" }, modifiedBy: { id: "7" } })) });
    if (path.endsWith("/members")) return ok({ data: [{ id: "7", name: "Nino Beridze" }, { id: "8", name: "Kavea Team" }] });
  }

  if (host === "api.dribbble.com") {
    if (path === "/v2/user") return ok({ name: "Nino Beridze", login: "ninob", created_at: "2019-03-01T00:00:00Z" });
    if (path === "/v2/user/shots") return ok(["Bloom app concept", "Kavea checkout", "Coffee menu"].map((t, i) => ({ id: i + 1, title: t, published_at: at(40 + i * 70) })));
  }

  // Open banking (Berlin Group) for TBC / Bank of Georgia: identity-only consent
  if (host.startsWith("openbanking.") && host.endsWith(".demo")) {
    if (path === "/v1/consents" && init?.method === "POST") {
      const back = new Headers(init.headers).get("tpp-redirect-uri") ?? "";
      const q = new URLSearchParams({ provider: host.includes("bog") ? "bog" : "tbc", scopes: "Account owner name only (allAccountsWithOwnerName)", next: back });
      return ok({ consentId: "demo-consent-123", consentStatus: "received", _links: { scaRedirect: { href: `${new URL(back).origin}/beta/mock-consent?${q}` } } }, 201);
    }
    if (path.endsWith("/status")) return ok({ consentStatus: "valid" });
    if (path === "/v1/accounts") return ok({ accounts: [{ resourceId: "acc1", iban: "GE29TB0000000000004821", currency: "GEL", ownerName: "BERIDZE NINO" }] });
  }

  return new Response(JSON.stringify({ error: `demo mode has no stand-in for ${host}${path}` }), { status: 404 });
};
