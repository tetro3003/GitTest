import { dkimVerify } from "mailauth";
import { simpleParser } from "mailparser";
import { toUsd } from "@/lib/beta/fx";
import type { NewPayment, Run } from "../store";
import { extractPayments, type EmailInput } from "./email-extract";
import { ProviderError } from "./figma";
import { bearerGet, type OAuthSecret } from "./oauth";

/**
 * Gmail, read-only. Only emails FROM the payment companies below are ever
 * requested; the search runs on Google's side, so personal mail never leaves Gmail.
 *
 * Each email must prove it really came from that company:
 *  1. DKIM: the company signs every email with a secret key. We fetch the
 *     company's public key from DNS and check the signature ourselves. One changed
 *     character breaks it.
 *  2. Google's stamp: Gmail records at delivery whether the signature was valid
 *     (Authentication-Results). It covers older emails whose signing key the
 *     company has since replaced.
 * Emails that pass neither are thrown away.
 */

type Fetch = typeof fetch;
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const PAYMENT_SENDERS: { domain: string; platform: string }[] = [
  { domain: "upwork.com", platform: "Upwork" },
  { domain: "fiverr.com", platform: "Fiverr" },
  { domain: "paypal.com", platform: "PayPal" },
  { domain: "payoneer.com", platform: "Payoneer" },
];

export const gmailQuery = (afterEpoch?: number) =>
  `from:(${PAYMENT_SENDERS.map((s) => s.domain).join(" OR ")})${afterEpoch ? ` after:${afterEpoch}` : " newer_than:13m"}`;

const platformFor = (domain: string) => PAYMENT_SENDERS.find((s) => domain === s.domain || domain.endsWith(`.${s.domain}`));

export type EmailTrust = "dkim" | "google-stamp" | "failed";

/** Checks one raw email. `resolver` lets tests supply DNS answers. */
export async function verifyPaymentEmail(raw: Buffer, opts: { resolver?: (name: string, rr: string) => Promise<unknown> } = {}): Promise<{ trust: EmailTrust; domain: string | null; detail: string }> {
  const res = await dkimVerify(raw, opts.resolver ? { resolver: opts.resolver as never } : {});
  const fromDomain = (res.headerFrom?.[0] ?? "").split("@")[1]?.toLowerCase() ?? "";
  const sender = platformFor(fromDomain);
  if (!sender) return { trust: "failed", domain: fromDomain || null, detail: `Sender ${fromDomain || "unknown"} isn't a payment company we read` };
  const pass = res.results.find((r) => r.status?.result === "pass" && r.signingDomain && platformFor(String(r.signingDomain).toLowerCase())?.domain === sender.domain);
  if (pass) return { trust: "dkim", domain: sender.domain, detail: `DKIM signature valid (d=${pass.signingDomain})` };

  // Google's own delivery stamp: only trust the header Google added (authserv-id mx.google.com), the top-most one.
  const head = raw.toString("utf8", 0, Math.min(raw.length, 200_000)).split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
  const stamp = head.split(/\r?\n/).find((l) => /^Authentication-Results:\s*mx\.google\.com;/i.test(l));
  const m = stamp?.match(/dkim=pass[^;]*header\.(?:i|d)=@?([\w.-]+)/i);
  if (m && platformFor(m[1].toLowerCase())?.domain === sender.domain) return { trust: "google-stamp", domain: sender.domain, detail: `Google confirmed the signature at delivery (dkim=pass ${m[1]})` };
  return { trust: "failed", domain: sender.domain, detail: "No valid signature from the company: possibly forged or altered" };
}

interface GmailMessage {
  id: string;
  internalDate: string;
  raw: string;
}

export async function readGmailPayments(
  secret: OAuthSecret,
  state: { afterEpoch?: number },
  run: Run,
  f: Fetch = fetch,
  opts: { resolver?: (name: string, rr: string) => Promise<unknown>; useAi?: boolean } = {},
): Promise<{ email: string; payments: NewPayment[]; newestEpoch: number | undefined }> {
  const get = bearerGet("Gmail", secret.accessToken, f);
  run.step("trustline", "Asking Gmail which account this is", `GET ${API}/profile`);
  const profile = await get<{ emailAddress: string }>(`${API}/profile`);
  run.ok("google", `Gmail account: ${profile.emailAddress}`);

  const q = gmailQuery(state.afterEpoch);
  run.step("trustline", `Searching only emails from ${PAYMENT_SENDERS.map((s) => s.platform).join(", ")}`, `GET ${API}/messages?q=${q}`);
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const r = await get<{ messages?: { id: string }[]; nextPageToken?: string }>(`${API}/messages?maxResults=100&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`);
    ids.push(...(r.messages ?? []).map((m) => m.id));
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  run.ok("google", `${ids.length} email${ids.length === 1 ? "" : "s"} from payment companies${state.afterEpoch ? " since the last check" : " in the last 13 months"}`, "Personal emails are never requested");
  if (!ids.length) return { email: profile.emailAddress, payments: [], newestEpoch: state.afterEpoch };

  const verified: (EmailInput & { trust: EmailTrust; trustDetail: string })[] = [];
  const failed: string[] = [];
  let newest = state.afterEpoch ?? 0;
  run.step("trustline", "Downloading the original emails and checking each company's digital signature", `GET ${API}/messages/{id}?format=raw · DKIM check against the company's public key in DNS`);
  for (const id of ids.slice(0, 300)) {
    const m = await get<GmailMessage>(`${API}/messages/${id}?format=raw`);
    newest = Math.max(newest, Math.floor(Number(m.internalDate) / 1000));
    const raw = Buffer.from(m.raw, "base64url");
    const v = await verifyPaymentEmail(raw, opts);
    if (v.trust === "failed") {
      failed.push(v.detail);
      continue;
    }
    const mail = await simpleParser(raw);
    const text = (mail.text ?? (typeof mail.html === "string" ? mail.html.replace(/<[^>]+>/g, " ") : "")).replace(/\s+\n/g, "\n").trim();
    verified.push({ id, platform: platformFor(v.domain!)!.platform, from: mail.from?.text ?? v.domain!, subject: mail.subject ?? "", date: (mail.date ?? new Date(Number(m.internalDate))).toISOString(), text, trust: v.trust, trustDetail: v.detail });
  }
  const viaDkim = verified.filter((v) => v.trust === "dkim").length;
  run.ok("trustline", `${verified.length} genuine email${verified.length === 1 ? "" : "s"}: ${viaDkim} by live signature check, ${verified.length - viaDkim} by Google's delivery stamp`);
  if (failed.length) run.warn("trustline", `${failed.length} email${failed.length === 1 ? "" : "s"} failed the signature check and ${failed.length === 1 ? "was" : "were"} thrown away`, failed[0]);

  const { method, results } = await extractPayments(verified, { useAi: opts.useAi });
  run.step(method === "ai" ? "ai" : "trustline", method === "ai" ? `Claude read ${verified.length} verified email${verified.length === 1 ? "" : "s"} and pulled out amount, client and date` : `Reading amount, client and date with built-in rules (add an Anthropic key for AI reading)`, method === "ai" ? "claude-opus-5-5 · structured JSON output · only signature-verified emails are sent" : null);

  const payments: NewPayment[] = [];
  let skipped = 0;
  for (const r of results) {
    const e = verified.find((v) => v.id === r.id)!;
    if (!r.amount || !r.currency || !["client_payment", "platform_payout", "refund"].includes(r.kind)) {
      skipped++;
      continue;
    }
    const usd = toUsd(r.amount, r.currency);
    if (usd == null) {
      skipped++;
      continue;
    }
    payments.push({
      extId: `gmail:${e.id}`,
      at: r.date,
      source: "email",
      amountUsd: usd,
      asset: r.currency,
      chain: e.platform,
      payer: r.payer ?? e.platform,
      payerLabel: null,
      status: r.kind === "client_payment" ? "income" : "not_income",
      note: r.kind === "platform_payout" ? `Moving your own money out of ${e.platform}, not new income` : r.kind === "refund" ? "Refund" : null,
      proof: `Gmail · “${e.subject.slice(0, 80)}” · ${e.trustDetail}`,
    });
  }
  const income = payments.filter((p) => p.status === "income");
  run.ok("trustline", `${income.length} client payment${income.length === 1 ? "" : "s"} found ($${Math.round(income.reduce((a, p) => a + p.amountUsd, 0)).toLocaleString("en-US")})${skipped ? `; ${skipped} other email${skipped === 1 ? "" : "s"} (invoices, fees, notices) skipped` : ""}`);
  if (!profile.emailAddress) throw new ProviderError("Gmail didn't return the account address");
  return { email: profile.emailAddress, payments, newestEpoch: newest || undefined };
}
