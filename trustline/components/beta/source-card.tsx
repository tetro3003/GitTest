"use client";

import { useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Settings2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { betaApi, type SetupState } from "@/lib/beta/client";
import type { BetaConnection, OAuthProvider } from "@/lib/beta/types";
import { cn } from "@/lib/utils";
import { SourceMark } from "./brand-icons";
import { ConnectionActions, lastSync, StatusBadge } from "./connection-bits";
import { SetupGuide } from "./setup-guide";

export interface SourceSpec {
  provider: "gmail" | "wise" | "bank" | "canva" | "webflow" | "miro" | "dribbble";
  name: string;
  what: string;
  /** "Sign in with …" provider, if any. */
  oauth?: OAuthProvider;
  /** Paste-a-token alternative. */
  token?: { kind: "wise" | "webflow"; label: string; help: React.ReactNode };
  /** File import (monthly TBC statement). */
  upload?: { accept: string; help: React.ReactNode };
  badge?: string;
  /** What the connected card shows as its count. */
  count: (c: BetaConnection) => string;
}

export function SourceCard({ spec, connections, setup, onChange, onError }: { spec: SourceSpec; connections: BetaConnection[]; setup: SetupState | null; onChange: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const configured = spec.oauth ? !!setup?.[spec.oauth] : false;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    act(async () => {
      const { url } = await betaApi.oauthStart(spec.oauth!);
      window.location.href = url;
    });

  const submitToken = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get("token") ?? "");
    void act(() => betaApi.pasteToken(spec.token!.kind, token)).then(() => setShowToken(false));
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    void act(async () => betaApi.bankImport(file.name, await file.text()));
    if (fileRef.current) fileRef.current.value = "";
  };

  const canAddMore = spec.provider !== "bank";

  return (
    <div className="glass flex flex-col rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <SourceMark provider={spec.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{spec.name}</p>
            {spec.badge && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{spec.badge}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{spec.what}</p>
        </div>
      </div>

      {connections.length > 0 && (
        <ul className="mt-4 space-y-2">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl border bg-background/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.label}</span>
                  <StatusBadge c={c} />
                </div>
                <p className="text-xs text-muted-foreground">{spec.count(c)} · {spec.provider === "bank" ? `file: ${String(c.settings.file ?? "")}` : lastSync(c)}</p>
                {c.lastError && <p className="text-xs text-risk">{c.lastError}</p>}
              </div>
              <ConnectionActions c={c} onSync={() => act(() => betaApi.sync(c.id))} onDisconnect={() => act(() => betaApi.disconnect(c.id))} />
            </li>
          ))}
        </ul>
      )}

      {(connections.length === 0 || canAddMore) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {spec.oauth && configured && (
            <Button size="sm" className="rounded-xl" onClick={signIn} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} {connections.length ? "Add another" : `Connect ${spec.name}`}
            </Button>
          )}
          {spec.oauth && !configured && (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowSetup((x) => !x)} aria-expanded={showSetup}>
              <Settings2 /> {showSetup ? "Hide setup steps" : `How to turn on ${spec.name}`}
            </Button>
          )}
          {spec.token && (
            <Button size="sm" variant={spec.oauth ? "ghost" : "default"} className="rounded-xl" onClick={() => setShowToken((x) => !x)} disabled={busy}>
              <KeyRound /> {spec.token.label}
            </Button>
          )}
          {spec.upload && (
            <>
              <input ref={fileRef} type="file" accept={spec.upload.accept} className="sr-only" id={`up-${spec.provider}`} onChange={(e) => upload(e.target.files?.[0])} />
              <Button size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} {connections.length ? "Upload this month's statement" : "Upload statement"}
              </Button>
            </>
          )}
        </div>
      )}
      {spec.oauth && !configured && !showSetup && <p className="mt-2 text-xs text-muted-foreground">Needs a free {spec.name} developer app first (one-time, ~5 minutes).</p>}
      {spec.oauth && !configured && showSetup && <SetupGuide provider={spec.oauth} name={spec.name} />}
      {spec.upload && <div className="mt-2 text-xs text-muted-foreground">{spec.upload.help}</div>}

      {showToken && spec.token && (
        <form onSubmit={submitToken} className={cn("mt-3 space-y-2 rounded-2xl border border-dashed bg-background/50 p-4")}>
          <div className="text-sm">{spec.token.help}</div>
          <Label htmlFor={`tok-${spec.provider}`}>Token</Label>
          <div className="flex gap-2">
            <Input id={`tok-${spec.provider}`} name="token" type="password" autoComplete="off" required />
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Connect"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Encrypted in our vault and only used to read. Delete it on {spec.name} any time to cut access.</p>
        </form>
      )}
    </div>
  );
}

export const WORK_SOURCES: SourceSpec[] = [
  { provider: "canva", name: "Canva", oauth: "canva", what: "Designs you own and when you worked on them.", count: (c) => `${c.stats.workItems} work facts` },
  {
    provider: "webflow",
    name: "Webflow",
    oauth: "webflow",
    what: "Sites you built, publishes, and clients' own domains.",
    token: { kind: "webflow", label: "Use a site token", help: <>Webflow → Site settings → <strong>Apps &amp; integrations → API access → Generate API token</strong> (read-only: Sites, Pages). One token per site.</> },
    count: (c) => `${c.stats.workItems} work facts`,
  },
  { provider: "miro", name: "Miro", oauth: "miro", what: "Your edits on boards and who you collaborate with.", count: (c) => `${c.stats.workItems} work facts` },
  { provider: "dribbble", name: "Dribbble", oauth: "dribbble", what: "Published shots and how long you've been active.", count: (c) => `${c.stats.workItems} shots` },
];

export const MONEY_SOURCES: SourceSpec[] = [
  {
    provider: "gmail",
    name: "Gmail",
    oauth: "google",
    what: "Payment emails from Upwork, Fiverr, PayPal and Payoneer only. Each one's digital signature is checked.",
    count: (c) => `${c.stats.payments} client payments`,
  },
  {
    provider: "wise",
    name: "Wise",
    what: "Incoming payments and who sent them.",
    token: { kind: "wise", label: "Connect with a read-only token", help: <>Wise → <strong>Settings → Developer tools → API tokens → Add new token</strong>, choose <strong>Read only</strong>, copy it here.</> },
    count: (c) => `${c.stats.payments} payments`,
  },
  {
    provider: "bank",
    name: "TBC Bank",
    badge: "Monthly",
    what: "Upload your statement once a month. Open banking only confirms the account is yours, so transactions come from the statement.",
    upload: { accept: ".csv,.json,text/csv,application/json", help: <>Export from TBC internet banking (CSV with date, amount, currency, counterparty), or the bank&apos;s open-banking JSON. Shown to lenders as “uploaded statement”.</> },
    count: (c) => `${c.stats.payments} incoming${c.lastSyncAt ? ` · next statement due ${new Date(new Date(c.lastSyncAt).getTime() + 30 * 864e5).toLocaleDateString([], { day: "numeric", month: "short" })}` : ""}`,
  },
];
