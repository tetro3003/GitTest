"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { betaApi } from "@/lib/beta/client";
import type { AuditEvent, LenderDecision, LenderShare } from "@/lib/beta/types";
import { cn } from "@/lib/utils";

const DECISION: Record<LenderDecision["decision"], { label: string; cls: string }> = {
  approve: { label: "Approved", cls: "bg-positive-soft text-positive" },
  decline: { label: "Declined", cls: "bg-risk-soft text-risk" },
  request_info: { label: "More information requested", cls: "bg-warning-soft text-warning-strong" },
};

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** Freelancer side: give a lender consent, see their decision and everything they did. */
export function ShareCard({ onChange, onError, refreshKey }: { onChange: () => void; onError: (m: string) => void; refreshKey: number }) {
  const [lenders, setLenders] = useState<{ id: string; org: string }[]>([]);
  const [data, setData] = useState<{ shares: LenderShare[]; decisions: LenderDecision[]; audit: AuditEvent[] } | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void betaApi.lenders().then(setLenders).catch(() => {});
    void betaApi.shares().then(setData).catch(() => {});
  }, [refreshKey]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setData(await betaApi.shares());
      onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = (data?.shares ?? []).filter((s) => !s.revokedAt);
  const available = lenders.filter((l) => !active.some((s) => s.lenderId === l.id));

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 text-white shadow-lg shadow-teal-500/20">
          <Send className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Share with a lender</p>
          <p className="text-sm text-muted-foreground">The lender sees your score, verified income, reasons and evidence. A person at the bank makes the decision. Revoke any time.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <NativeSelect value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-48 flex-1 rounded-xl" aria-label="Choose a lender">
          <option value="">{available.length ? "Choose a lender…" : "No lenders available yet"}</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>{l.org}</option>
          ))}
        </NativeSelect>
        <Button className="rounded-xl" disabled={!pick || busy} onClick={() => act(async () => { await betaApi.share(pick); setPick(""); })}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />} Share my report
        </Button>
      </div>

      {active.length > 0 && (
        <ul className="mt-4 space-y-2">
          {active.map((s) => {
            const d = data?.decisions.find((x) => x.lenderId === s.lenderId);
            return (
              <li key={s.id} className="rounded-2xl border bg-background/50 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.lenderOrg}</p>
                    <p className="text-xs text-muted-foreground">Shared {when(s.createdAt)}</p>
                  </div>
                  {d ? (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", DECISION[d.decision].cls)}>
                      {DECISION[d.decision].label}{d.amountUsd ? ` · up to $${Math.round(d.amountUsd).toLocaleString("en-US")}/mo` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Waiting for review</span>
                  )}
                  <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground hover:text-risk" onClick={() => act(() => betaApi.revokeShare(s.id))} aria-label={`Revoke ${s.lenderOrg}`}>
                    <X /> Revoke
                  </Button>
                </div>
                {d?.note && <p className="mt-1.5 pl-8 text-xs text-muted-foreground">“{d.note}” · {d.officer}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {data && data.audit.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Who accessed my data ({data.audit.length})</summary>
          <ul className="mt-2 space-y-1.5 text-xs">
            {data.audit.map((a) => (
              <li key={a.id} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-positive" />
                <span><span className="font-medium">{a.action}</span> · {a.actor} · {when(a.at)}{a.detail ? <span className="block text-muted-foreground">{a.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
