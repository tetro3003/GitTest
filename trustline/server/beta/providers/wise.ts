import { toUsd } from "@/lib/beta/fx";
import type { NewPayment, Run } from "../store";
import { ProviderError } from "./figma";

/**
 * Wise, with a read-only personal API token the designer creates in
 * Wise → Settings → Developer tools → API tokens (Read only).
 * We read each currency balance's statement and keep incoming money.
 */

type Fetch = typeof fetch;
const API = "https://api.wise.com";

interface Profile {
  id: number;
  type: string;
  fullName?: string;
  details?: { firstName?: string; lastName?: string; name?: string };
}
interface StatementTx {
  type: "CREDIT" | "DEBIT";
  date: string;
  amount: { value: number; currency: string };
  details?: { type?: string; description?: string; senderName?: string; paymentReference?: string };
  referenceNumber: string;
}

const profileName = (p: Profile) => p.fullName ?? p.details?.name ?? ([p.details?.firstName, p.details?.lastName].filter(Boolean).join(" ") || null);

export async function readWisePayments(token: string, run: Run, f: Fetch = fetch, now = new Date()): Promise<{ holderName: string | null; payments: NewPayment[] }> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new ProviderError("Wise rejected the token. Create a new read-only token and paste it again.", 401);
    if (res.status === 403 && res.headers.get("x-2fa-approval"))
      throw new ProviderError("Wise asks for extra confirmation (SCA) before sharing statements on this account, which a personal token can't give. Wise blocks this for some EU/UK personal accounts.", 403);
    if (res.status === 403) throw new ProviderError("Wise refused: the token needs read access.", 403);
    if (!res.ok) throw new ProviderError(`Wise returned an error (${res.status})`, 502);
    return (await res.json()) as T;
  };

  run.step("trustline", "Asking Wise which profiles this token can read", `GET ${API}/v2/profiles`);
  const profiles = await get<Profile[]>("/v2/profiles");
  const holderName = profileName(profiles.find((p) => /personal/i.test(p.type)) ?? profiles[0]) ?? null;
  run.ok("wise", `${profiles.length} profile${profiles.length === 1 ? "" : "s"} · account holder: ${holderName ?? "unknown"}`);

  const end = now.toISOString();
  const start = new Date(now.getTime() - 400 * 864e5).toISOString();
  const payments: NewPayment[] = [];
  for (const p of profiles) {
    run.step("trustline", `Listing currency balances for the ${p.type.toLowerCase()} profile`, `GET ${API}/v4/profiles/${p.id}/balances?types=STANDARD`);
    const balances = await get<{ id: number; currency: string }[]>(`/v4/profiles/${p.id}/balances?types=STANDARD`);
    for (const b of balances) {
      run.step("trustline", `Reading the ${b.currency} statement (last 13 months)`, `GET ${API}/v1/profiles/${p.id}/balance-statements/${b.id}/statement.json?currency=${b.currency}&type=COMPACT`);
      const st = await get<{ transactions: StatementTx[] }>(`/v1/profiles/${p.id}/balance-statements/${b.id}/statement.json?currency=${b.currency}&intervalStart=${start}&intervalEnd=${end}&type=COMPACT`);
      let n = 0;
      for (const t of st.transactions ?? []) {
        if (t.type !== "CREDIT") continue;
        const kind = (t.details?.type ?? "").toUpperCase();
        const usd = toUsd(Math.abs(t.amount.value), t.amount.currency);
        if (usd == null) continue;
        const own = ["MONEY_ADDED", "CONVERSION", "BALANCE_CASHBACK", "BALANCE_INTEREST", "ACCRUAL_CHARGE"].includes(kind);
        const sender = t.details?.senderName?.trim() || null;
        const isSelf = !!sender && !!holderName && sender.toLowerCase() === holderName.toLowerCase();
        payments.push({
          extId: `wise:${t.referenceNumber}`,
          at: new Date(t.date).toISOString(),
          source: "wise",
          amountUsd: usd,
          asset: t.amount.currency,
          chain: "Wise",
          payer: sender ?? t.details?.description ?? "Unknown sender",
          payerLabel: null,
          status: own || isSelf ? "own_transfer" : "income",
          note: own ? "Top-up, conversion or interest: your own money" : isSelf ? "Sent by you" : null,
          proof: `Wise statement · ref ${t.referenceNumber}`,
        });
        n++;
      }
      run.ok("wise", `${b.currency}: ${n} incoming transaction${n === 1 ? "" : "s"}`);
    }
  }
  return { holderName, payments };
}
