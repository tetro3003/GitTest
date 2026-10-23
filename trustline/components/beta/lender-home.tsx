"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bot, Check, ChevronRight, ClipboardCheck, FileText, Gauge, Landmark, Loader2, ScrollText, ShieldCheck, Timer, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { betaApi } from "@/lib/beta/client";
import { RECOMMENDATION_LABEL } from "@/lib/beta/decision";
import { BANK_NAMES, type ApplicantSummary, type BetaUser, type DecisionKind, type LenderReport } from "@/lib/beta/types";
import { cn } from "@/lib/utils";
import { PaymentsTable } from "./payments-table";
import { ScoreDetails } from "./score-panel";
import { WorkTable } from "./work-table";

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const DECISION_STYLE: Record<DecisionKind, { label: string; cls: string }> = {
  approve: { label: "Approved", cls: "bg-positive-soft text-positive" },
  decline: { label: "Declined", cls: "bg-risk-soft text-risk" },
  request_info: { label: "Info requested", cls: "bg-warning-soft text-warning-strong" },
};

/** Lender side: applicants who shared their report with this bank. */
export function LenderHome({ me, onError }: { me: BetaUser; onError: (m: string) => void }) {
  const [list, setList] = useState<ApplicantSummary[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    void betaApi.applicants().then(setList).catch((e) => onError((e as Error).message));
  }, [onError]);
  useEffect(load, [load]);

  if (open) return <Review applicantId={open} me={me} onBack={() => { setOpen(null); load(); }} onError={onError} />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{me.org} · lender workspace</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Applicants</h1>
        <p className="mt-1 text-muted-foreground">Freelancers who shared their verified report with {me.org}. You make every decision; Trustline only suggests.</p>
      </div>
      {list === null && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>}
      {list?.length === 0 && <div className="glass rounded-3xl p-8 text-center text-muted-foreground">No applicants yet. When a freelancer shares their report with {me.org}, they appear here.</div>}
      <ul className="space-y-3">
        {list?.map((a) => (
          <li key={a.applicantId}>
            <button onClick={() => setOpen(a.applicantId)} className="glass flex w-full items-center gap-4 rounded-3xl p-5 text-left transition hover:-translate-y-0.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-500 font-display text-lg font-bold text-white">{a.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.name}</span>
                <span className="block text-sm text-muted-foreground">Shared {when(a.sharedAt)} · verified {usd(a.verifiedMonthlyIncome)}/month{a.flags ? ` · ${a.flags} risk signal${a.flags === 1 ? "" : "s"}` : ""}</span>
              </span>
              <span className="text-right">
                <span className="block font-display text-2xl font-bold tabular-nums">{a.score ?? "—"}</span>
                <span className="block text-xs text-muted-foreground">{a.band ? `band ${a.band}` : "no score yet"}</span>
              </span>
              {a.lastDecision ? (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", DECISION_STYLE[a.lastDecision.decision].cls)}>{DECISION_STYLE[a.lastDecision.decision].label}</span>
              ) : (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">To review</span>
              )}
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Review({ applicantId, me, onBack, onError }: { applicantId: string; me: BetaUser; onBack: () => void; onError: (m: string) => void }) {
  const [r, setR] = useState<LenderReport | null>(null);
  const [decision, setDecision] = useState<DecisionKind | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void betaApi
      .report(applicantId)
      .then((x) => {
        setR(x);
        setAmount(x.recommendation.maxMonthlyPayment ? String(Math.round(x.recommendation.maxMonthlyPayment)) : "");
      })
      .catch((e) => onError((e as Error).message));
  }, [applicantId, onError]);
  useEffect(load, [load]);

  const submit = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await betaApi.decide(applicantId, { decision, amountUsd: decision === "approve" ? Number(amount) : null, note });
      setDecision(null);
      setNote("");
      load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!r) return <p className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Building the report…</p>;
  const s = r.score;
  const bank = r.banks.find((b) => b.matchesAccount);
  const counted = r.payments.filter((p) => p.status === "income" && p.source !== "bank").length;
  const fromStatement = r.payments.filter((p) => p.status === "income" && p.source === "bank").length;
  const rec = r.recommendation;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="rounded-xl" onClick={onBack}><ArrowLeft /> All applicants</Button>

      <section className="night rounded-3xl p-6 sm:p-8" aria-labelledby="rev-h">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-teal-300">Verified report · shared {when(r.sharedAt)}</p>
            <h1 id="rev-h" className="mt-1 font-display text-3xl font-extrabold">{r.applicant.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              {bank && <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-200"><Landmark className="size-3.5" /> Identity confirmed by {BANK_NAMES[bank.bank]}</span>}
              {r.identity?.status === "verified" && <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-200"><UserCheck className="size-3.5" /> ID checked</span>}
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><ShieldCheck className="size-3.5" /> {counted} payments verified at source</span>
              {fromStatement > 0 && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><FileText className="size-3.5" /> {fromStatement} from bank statement</span>}
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><Timer className="size-3.5" /> Report built in {r.generatedMs} ms</span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs night-muted">Score</p>
              <p className="font-display text-4xl font-extrabold tabular-nums">{s.score ?? "—"}</p>
              <p className="text-xs night-muted">{s.band ? `band ${s.band}` : "not ready"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs night-muted">Verified income</p>
              <p className="font-display text-4xl font-extrabold tabular-nums">{usd(s.verifiedMonthlyIncome)}</p>
              <p className="text-xs night-muted">per month</p>
            </div>
          </div>
        </div>
        {s.flags.map((f) => (
          <p key={f.id} className={cn("mt-4 flex gap-2 rounded-2xl p-3 text-sm", f.severity === "high" ? "bg-rose-500/15 text-rose-200" : "bg-amber-400/15 text-amber-100")}>
            <AlertTriangle className="size-4 shrink-0" /> <span><strong>{f.title}.</strong> {f.detail}</span>
          </p>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="glass space-y-4 rounded-3xl p-5" aria-labelledby="memo-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="memo-h" className="flex items-center gap-2 font-display text-lg font-semibold"><FileText className="size-5 text-brand" /> Explanation for the officer</h2>
            <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", r.explanation.by === "claude" ? "bg-amber-400/20 text-amber-700 dark:text-amber-200" : "bg-muted text-muted-foreground")}>
              <Bot className="size-3.5" /> {r.explanation.by === "claude" ? "Written by Claude from verified facts" : "Rule-based summary"}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed">{r.explanation.text}</p>
          {r.explanation.note && <p className="rounded-xl bg-warning-soft p-2.5 text-xs text-warning-strong">Fallback: {r.explanation.note}</p>}
          <div className="rounded-2xl border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Gauge className="size-4 text-brand" /> {RECOMMENDATION_LABEL[rec.action]}{rec.maxMonthlyPayment ? ` · up to ${usd(rec.maxMonthlyPayment)}/month` : ""}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {rec.why.map((w) => <li key={w}>• {w}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">A suggestion only. The decision below is yours.</p>
          </div>
        </section>

        <section className="glass space-y-4 rounded-3xl p-5" aria-labelledby="dec-h">
          <h2 id="dec-h" className="flex items-center gap-2 font-display text-lg font-semibold"><ClipboardCheck className="size-5 text-brand" /> Your decision</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Decision">
            {([["approve", "Approve", Check], ["request_info", "Request info", FileText], ["decline", "Decline", X]] as const).map(([v, label, Icon]) => (
              <button key={v} role="radio" aria-checked={decision === v} onClick={() => setDecision(v)} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-3 text-sm font-semibold transition", decision === v ? (v === "approve" ? "border-positive bg-positive-soft text-positive" : v === "decline" ? "border-risk bg-risk-soft text-risk" : "border-warning-strong bg-warning-soft text-warning-strong") : "hover:bg-muted/60")}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
          {decision === "approve" && (
            <div className="space-y-1.5">
              <Label htmlFor="amt">Approved monthly repayment (USD)</Label>
              <Input id="amt" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl" />
            </div>
          )}
          {decision && (
            <div className="space-y-1.5">
              <Label htmlFor="note">{decision === "approve" ? "Note (optional)" : "Reason shown to the applicant"}</Label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm" />
            </div>
          )}
          <Button className="w-full rounded-xl" disabled={!decision || busy} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Record decision as {me.name}
          </Button>
          {r.decisions.length > 0 && (
            <ul className="space-y-2">
              {r.decisions.map((d) => (
                <li key={d.id} className="rounded-2xl border bg-background/50 px-3 py-2 text-sm">
                  <span className={cn("mr-2 rounded-full px-2 py-0.5 text-xs font-semibold", DECISION_STYLE[d.decision].cls)}>{DECISION_STYLE[d.decision].label}</span>
                  {d.amountUsd ? `up to ${usd(d.amountUsd)}/month · ` : ""}{d.officer} · {when(d.createdAt)}
                  {d.note && <span className="mt-1 block text-xs text-muted-foreground">“{d.note}”</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ScoreDetails score={s} />
      <WorkTable work={r.work} />
      <PaymentsTable payments={r.payments} />

      <section className="glass rounded-3xl p-5" aria-labelledby="audit-h">
        <h2 id="audit-h" className="flex items-center gap-2 font-display text-lg font-semibold"><ScrollText className="size-5 text-brand" /> Audit trail</h2>
        <p className="text-sm text-muted-foreground">Every access and decision on this applicant, newest first. The applicant sees the same list.</p>
        <ol className="mt-3 divide-y">
          {r.audit.map((a) => (
            <li key={a.id} className="grid gap-1 py-2 text-sm sm:grid-cols-[170px_1fr]">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{when(a.at)}</span>
              <span><span className="font-medium">{a.action}</span> · {a.actor}{a.detail && <span className="block text-xs text-muted-foreground">{a.detail}</span>}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
