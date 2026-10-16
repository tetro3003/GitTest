"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Check, Copy, Landmark, Loader2, Car, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, Label } from "@/components/ui/input";
import { CardSkeleton, ErrorState } from "@/components/states";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import type { Lender, Share } from "@/lib/types";
import { cn } from "@/lib/utils";

const SCOPES = [
  { id: "Score & band", desc: "Your score (300–850) and band A–E", required: true },
  { id: "Verified income", desc: "Monthly verified income and affordable payment", required: true },
  { id: "Reasons", desc: "The factors behind your score", required: true },
  { id: "Fraud checks", desc: "Results of consistency checks", required: true },
  { id: "Transactions", desc: "Categorized transactions (names of your clients included)", required: false },
  { id: "Work activity", desc: "Weekly hours, trips and ratings", required: false },
];

const TYPE_ICON = { bank: Landmark, mfi: Building2, leasing: Car } as const;

export default function ShareWithLender() {
  const { personaId, invalidate } = useDemo();
  const lenders = useApi(() => api.listLenders(), []);
  const [lender, setLender] = useState<Lender | null>(null);
  const [scope, setScope] = useState<string[]>(SCOPES.map((s) => s.id));
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [share, setShare] = useState<Share | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!lender) return;
    setBusy(true);
    setError(undefined);
    try {
      const s = await api.shareWithLender(personaId, lender.id, { days, scope });
      setShare(s);
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (share)
    return (
      <div className="mx-auto max-w-md space-y-5 py-6 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-positive-soft text-positive">
          <Check className="size-8" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Shared with {share.lenderName}</h1>
          <p className="mt-1 text-muted-foreground">Give this code to your loan officer. Access ends {formatDate(share.expiresAt)}.</p>
        </div>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Share code</p>
          <p className="tabular mt-1 font-mono text-3xl font-semibold tracking-wider">{share.code}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard?.writeText(share.code).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy code"}
          </Button>
        </Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link href="/borrower/consents">Manage shares</Link>
          </Button>
          <Button asChild>
            <Link href="/borrower/profile">Back to profile</Link>
          </Button>
        </div>
      </div>
    );

  if (lender)
    return (
      <div className="mx-auto max-w-md space-y-5">
        <button onClick={() => setLender(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Choose another lender
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Share with {lender.name}</h1>
          <p className="mt-1 text-muted-foreground">Review exactly what {lender.name} will see.</p>
        </div>
        <Card className="divide-y">
          {SCOPES.map((s) => {
            const checked = scope.includes(s.id);
            return (
              <label key={s.id} className={cn("flex items-start gap-3 p-4", !s.required && "cursor-pointer")}>
                <Checkbox
                  checked={checked}
                  disabled={s.required}
                  onCheckedChange={(v) => setScope((cur) => (v ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                  aria-label={s.id}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium">
                    {s.id} {s.required && <span className="text-xs font-normal text-muted-foreground">· required</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.desc}</span>
                </span>
              </label>
            );
          })}
        </Card>
        <div className="space-y-2">
          <Label htmlFor="expiry">Access expires after</Label>
          <NativeSelect id="expiry" className="w-full" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" /> You can revoke access anytime from My data. {lender.name} can&apos;t see sources you haven&apos;t connected.
        </p>
        {error && <ErrorState error={error} onRetry={submit} />}
        <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} I agree — share my profile
        </Button>
      </div>
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Share with a lender</h1>
        <p className="mt-1 text-muted-foreground">Pick who should see your profile.</p>
      </div>
      {lenders.loading && !lenders.data && (
        <div className="space-y-3">
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
      )}
      {lenders.error && <ErrorState error={lenders.error} onRetry={lenders.reload} />}
      <ul className="grid gap-3 sm:grid-cols-2">
        {lenders.data?.map((l) => {
          const Icon = TYPE_ICON[l.type];
          return (
            <li key={l.id}>
              <button onClick={() => setLender(l)} className="w-full text-left">
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{l.name}</span>
                    <span className="block text-sm text-muted-foreground">{l.description}</span>
                  </span>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
