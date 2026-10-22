"use client";

import { useState } from "react";
import { ArrowRight, Check, Landmark, Loader2, Settings2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { betaApi, type SetupState } from "@/lib/beta/client";
import { BANK_NAMES, type BankId, type BankIdentity } from "@/lib/beta/types";
import { SourceMark } from "./brand-icons";

const BANKS: BankId[] = ["tbc", "bog"];

/** Identity through open banking: the bank confirms the account holder's name. Nothing else is read. */
export function BankIdCard({ banks, setup, onError }: { banks: BankIdentity[]; setup: SetupState | null; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<BankId | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const configured = (b: BankId) => !!setup?.[b === "tbc" ? "tbcId" : "bogId"];
  const confirmed = banks.find((b) => b.matchesAccount);

  const start = async (bank: BankId) => {
    setBusy(bank);
    try {
      const { url } = await betaApi.bankIdentityStart(bank);
      window.location.href = url;
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
          <Landmark className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Confirm with your bank</p>
          <p className="text-sm text-muted-foreground">
            {confirmed
              ? `${BANK_NAMES[confirmed.bank]} confirmed you are ${confirmed.holderName}.`
              : "Your bank already checked your ID when you opened the account. Through open banking it confirms your name: no balances, no transactions."}
          </p>
        </div>
      </div>

      {banks.length > 0 && (
        <ul className="mt-4 space-y-2">
          {banks.map((b) => (
            <li key={b.bank} className="flex items-center gap-3 rounded-2xl border bg-background/50 px-3 py-2">
              <SourceMark provider={b.bank} className="size-9" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{b.holderName}</p>
                <p className="text-xs text-muted-foreground">
                  {BANK_NAMES[b.bank]} · {b.accounts.length ? `accounts …${b.accounts.join(", …")}` : "account holder"} · {b.confirmedAt.slice(0, 10)}
                </p>
              </div>
              {b.matchesAccount ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-positive"><Check className="size-3.5" /> Matches</span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-risk"><TriangleAlert className="size-3.5" /> Different name</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {BANKS.map((b) =>
          configured(b) ? (
            <Button key={b} size="sm" className="rounded-xl" onClick={() => start(b)} disabled={!!busy}>
              {busy === b ? <Loader2 className="animate-spin" /> : <ArrowRight />} Confirm with {BANK_NAMES[b]}
            </Button>
          ) : (
            <Button key={b} size="sm" variant="outline" className="rounded-xl" disabled>
              <SourceMark provider={b} className="size-5 rounded-md !text-[7px]" /> {BANK_NAMES[b]}: not connected yet
            </Button>
          ),
        )}
        {BANKS.some((b) => !configured(b)) && (
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setShowSetup((x) => !x)} aria-expanded={showSetup}>
            <Settings2 /> {showSetup ? "Hide" : "How to turn on"}
          </Button>
        )}
      </div>

      {showSetup && (
        <div className="mt-3 space-y-2 rounded-2xl border border-dashed bg-background/50 p-4 text-sm">
          <p>
            Each bank gives open-banking access to registered apps. With the bank&apos;s sandbox (or the hackathon&apos;s TBC mock API), put its details in <code className="font-mono">.env.local</code> and restart:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-2.5 font-mono text-[11px] leading-relaxed">{`TBC_OB_BASE_URL=https://…   # address before /v1/consents
TBC_OB_TOKEN_URL=…          # if the bank issues app tokens
TBC_OB_CLIENT_ID=…
TBC_OB_CLIENT_SECRET=…
TBC_OB_API_KEY=…            # if the bank uses an API key

BOG_OB_BASE_URL=…           # same for Bank of Georgia`}</pre>
          <p className="text-xs text-muted-foreground">
            We ask only for <code className="font-mono">allAccountsWithOwnerName</code> (the standard Berlin Group consent for account owner names), approved by the person on the bank&apos;s own page, valid for one day.
          </p>
        </div>
      )}
    </div>
  );
}
