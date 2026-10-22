import { randomUUID } from "node:crypto";
import { BANK_NAMES, type BankId } from "@/lib/beta/types";
import type { Run } from "../store";
import { ProviderError } from "./figma";

/**
 * "Confirm with your bank": identity through open banking (Berlin Group NextGenPSD2,
 * the standard Georgian banks follow). We ask ONLY for the list of accounts with the
 * owner's name (access.availableAccounts = "allAccountsWithOwnerName"):
 * no balances, no transactions. The person approves on the bank's own page.
 * The bank verified that person's ID when the account was opened, so the name it
 * returns is the strongest identity proof we can get.
 *
 * Per bank (TBC_…, BOG_…):
 *   <B>_OB_BASE_URL       e.g. https://sandbox.bank.ge/openbanking (the part before /v1/…)
 *   <B>_OB_TOKEN_URL      optional: OAuth2 client-credentials token endpoint for our app
 *   <B>_OB_CLIENT_ID / <B>_OB_CLIENT_SECRET   for that token
 *   <B>_OB_API_KEY        optional: sent as the header named by <B>_OB_API_KEY_HEADER (default "apikey")
 */

type Fetch = typeof fetch;

const envKey = (bank: BankId) => bank.toUpperCase();
const env = (bank: BankId, k: string) => process.env[`${envKey(bank)}_OB_${k}`]?.trim() || undefined;

export const bankIdentityConfigured = (bank: BankId) => !!env(bank, "BASE_URL");
export const bankIdentityEnvNames = (bank: BankId) => [`${envKey(bank)}_OB_BASE_URL`, `${envKey(bank)}_OB_TOKEN_URL`, `${envKey(bank)}_OB_CLIENT_ID`, `${envKey(bank)}_OB_CLIENT_SECRET`, `${envKey(bank)}_OB_API_KEY`];

async function headers(bank: BankId, f: Fetch, run: Run | null): Promise<Record<string, string>> {
  const h: Record<string, string> = { "X-Request-ID": randomUUID(), Accept: "application/json", "PSU-IP-Address": "127.0.0.1" };
  const key = env(bank, "API_KEY");
  if (key) h[env(bank, "API_KEY_HEADER") ?? "apikey"] = key;
  const tokenUrl = env(bank, "TOKEN_URL");
  if (tokenUrl) {
    run?.step("trustline", `Identifying Trustline to ${BANK_NAMES[bank]}`, `POST ${tokenUrl} (client_credentials)`);
    const res = await f(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${env(bank, "CLIENT_ID") ?? ""}:${env(bank, "CLIENT_SECRET") ?? ""}`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "AIS" }),
    });
    if (!res.ok) throw new ProviderError(`${BANK_NAMES[bank]} didn't accept Trustline's app credentials (${res.status})`, 502);
    h.Authorization = `Bearer ${((await res.json()) as { access_token: string }).access_token}`;
  }
  return h;
}

/** Step 1: ask the bank for an identity-only consent. Returns where to send the person. */
export async function startBankIdentity(bank: BankId, redirectUri: string, run: Run, f: Fetch = fetch): Promise<{ consentId: string; redirect: string | null }> {
  const base = env(bank, "BASE_URL");
  if (!base) throw new ProviderError(`Confirming with ${BANK_NAMES[bank]} isn't set up on this server yet.`, 501);
  const h = await headers(bank, f, run);
  const validUntil = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  run.step("trustline", `Asking ${BANK_NAMES[bank]} for a one-time, identity-only permission`, `POST ${base}/v1/consents · access.availableAccounts = "allAccountsWithOwnerName" (no balances, no transactions)`);
  const res = await f(`${base}/v1/consents`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json", "TPP-Redirect-URI": redirectUri, "TPP-Redirect-Preferred": "true" },
    body: JSON.stringify({ access: { availableAccounts: "allAccountsWithOwnerName" }, recurringIndicator: false, validUntil, frequencyPerDay: 1, combinedServiceIndicator: false }),
  });
  if (!res.ok) throw new ProviderError(`${BANK_NAMES[bank]} refused the request (${res.status})`, 502);
  const j = (await res.json()) as { consentId: string; consentStatus?: string; _links?: Record<string, { href: string } | string> };
  const link = j._links?.scaRedirect ?? j._links?.scaOAuth;
  const href = typeof link === "string" ? link : link?.href ?? null;
  run.ok("bank", `${BANK_NAMES[bank]} created permission ${j.consentId.slice(0, 8)}…${href ? ": now approve it on the bank's page" : ""}`);
  return { consentId: j.consentId, redirect: href };
}

interface ObAccount {
  iban?: string;
  resourceId?: string;
  ownerName?: string;
  ownerNames?: { name: string }[];
  name?: string;
}

/** Step 2 (after the person approved): read the account owner's name. */
export async function finishBankIdentity(bank: BankId, consentId: string, run: Run, f: Fetch = fetch): Promise<{ holderName: string; accounts: string[] }> {
  const base = env(bank, "BASE_URL")!;
  const h = await headers(bank, f, null);
  run.step("trustline", "Checking the permission was approved", `GET ${base}/v1/consents/${consentId.slice(0, 8)}…/status`);
  const st = await f(`${base}/v1/consents/${consentId}/status`, { headers: h });
  if (!st.ok) throw new ProviderError(`${BANK_NAMES[bank]} couldn't confirm the permission (${st.status})`, 502);
  const status = ((await st.json()) as { consentStatus: string }).consentStatus;
  if (status !== "valid") throw new ProviderError(status === "rejected" ? "You declined at the bank" : `The bank says the permission is “${status}”`, 400);
  run.ok("bank", "You approved at the bank");
  run.step("trustline", "Reading only the account owner's name", `GET ${base}/v1/accounts (Consent-ID)`);
  const res = await f(`${base}/v1/accounts`, { headers: { ...h, "X-Request-ID": randomUUID(), "Consent-ID": consentId } });
  if (!res.ok) throw new ProviderError(`${BANK_NAMES[bank]} didn't return the accounts (${res.status})`, 502);
  const { accounts } = (await res.json()) as { accounts: ObAccount[] };
  const names = [...new Set(accounts.flatMap((a) => [a.ownerName, ...(a.ownerNames ?? []).map((o) => o.name)]).filter((x): x is string => !!x?.trim()))];
  if (!names.length) throw new ProviderError(`${BANK_NAMES[bank]} didn't share the account owner's name`, 502);
  run.ok("bank", `Account holder according to ${BANK_NAMES[bank]}: ${names[0]}${names.length > 1 ? ` (+${names.length - 1} joint)` : ""}`, "The bank verified this ID in person when the account was opened");
  return { holderName: names[0], accounts: accounts.map((a) => (a.iban ?? a.resourceId ?? "").slice(-4)).filter(Boolean) };
}
