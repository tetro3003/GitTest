"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Code2, Loader2, LogOut, X } from "lucide-react";
import { AuthForm } from "@/components/beta/auth-form";
import { FigmaCard } from "@/components/beta/figma-card";
import { BankIdCard } from "@/components/beta/bank-id-card";
import { IdCheckCard } from "@/components/beta/id-check";
import { LenderHome } from "@/components/beta/lender-home";
import { ShareCard } from "@/components/beta/share-card";
import { MONEY_SOURCES, SourceCard, WORK_SOURCES } from "@/components/beta/source-card";
import { PaymentsTable } from "@/components/beta/payments-table";
import { WorkTable } from "@/components/beta/work-table";
import { ScoreDetails, ScoreHero } from "@/components/beta/score-panel";
import { Timeline } from "@/components/beta/timeline";
import { WalletsCard } from "@/components/beta/wallets";
import { Button } from "@/components/ui/button";
import { BetaApiError, betaApi, type SetupState } from "@/lib/beta/client";
import type { BankIdentity, BetaConnection, BetaScore, BetaUser, IdentityCheck, PaymentFact, TimelineEntry, WorkFact } from "@/lib/beta/types";

export default function BetaHome() {
  const [me, setMe] = useState<{ user: BetaUser; figmaOAuth: boolean; setup: SetupState } | null | undefined>(undefined);
  const [identity, setIdentity] = useState<IdentityCheck | null>(null);
  const [bankIds, setBankIds] = useState<BankIdentity[]>([]);
  const [connections, setConnections] = useState<BetaConnection[]>([]);
  const [score, setScore] = useState<BetaScore | null>(null);
  const [payments, setPayments] = useState<PaymentFact[]>([]);
  const [work, setWork] = useState<WorkFact[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [showTech, setShowTech] = useState(true);
  const lastId = useRef(0);
  const fastUntil = useRef(0);

  const loadMe = useCallback(async () => {
    try {
      setMe(await betaApi.me());
    } catch (e) {
      if (e instanceof BetaApiError && e.status === 401) setMe(null);
      else setNotice({ kind: "error", text: (e as Error).message });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, s, p, t, id, w] = await Promise.all([betaApi.connections(), betaApi.score(), betaApi.payments(), betaApi.timeline(lastId.current), betaApi.identity(), betaApi.work()]);
      setWork(w);
      setIdentity(id.identity);
      setBankIds(id.banks);
      setConnections(c);
      setScore(s.score);
      setPayments(p);
      if (t.length) {
        lastId.current = Math.max(lastId.current, t[t.length - 1].id);
        // Two refreshes can overlap (dev mode runs effects twice, buttons refresh too): never add a line twice.
        setTimeline((old) => {
          const seen = new Set(old.map((e) => e.id));
          return [...old, ...t.filter((e) => !seen.has(e.id))].slice(-400);
        });
      }
    } catch (e) {
      if (e instanceof BetaApiError && e.status === 401) setMe(null);
    }
  }, []);

  const [tick, setTick] = useState(0);
  const onError = useCallback((text: string) => setNotice({ kind: "error", text }), []);
  const changed = useCallback(() => {
    fastUntil.current = Date.now() + 20_000;
    setTick((t) => t + 1);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadMe();
    const q = new URLSearchParams(window.location.search);
    if (q.get("figma")) setNotice({ kind: "info", text: "Figma connected. Now paste the links of the files that hold client work." });
    if (q.get("bankid")) setNotice({ kind: "info", text: "Your bank confirmed your identity." });
    if (q.get("connected")) setNotice({ kind: "info", text: "Connected. Watch Behind the scenes: we're reading it now." });
    if (q.get("error")) setNotice({ kind: "error", text: q.get("error")! });
    if (q.size) window.history.replaceState(null, "", "/beta");
  }, [loadMe]);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (stop) return;
      timer = setTimeout(loop, Date.now() < fastUntil.current ? 1500 : 10_000);
    };
    void loop();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [me, refresh]);

  useEffect(() => {
    if (connections.some((c) => c.status === "syncing")) fastUntil.current = Date.now() + 5000;
  }, [connections]);

  if (me === undefined) return <p className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>;
  if (me === null) return <AuthForm onDone={() => void loadMe()} />;

  const figma = connections.find((c) => c.provider === "figma") ?? null;
  const wallets = connections.filter((c) => c.provider === "wallet");
  const logout = async () => {
    await betaApi.logout();
    setMe(null);
    setNotice(null);
    setTimeline([]);
    lastId.current = 0;
  };
  const noticeBox = notice && (
    <div role={notice.kind === "error" ? "alert" : "status"} className={`beta-in flex items-start justify-between gap-3 rounded-2xl p-3 text-sm ${notice.kind === "error" ? "bg-risk-soft text-risk" : "bg-brand-soft text-brand-strong"}`}>
      <span>{notice.text}</span>
      <button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  );

  if (me.user.role === "lender")
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={logout}><LogOut /> Log out</Button>
        </div>
        {noticeBox}
        <LenderHome me={me.user} onError={onError} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Hi {me.user.name.split(" ")[0]} <span aria-hidden>👋</span></h1>
        </div>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>

      {noticeBox}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ScoreHero score={score} hasWork={connections.some((c) => c.stats.workItems > 0)} hasIncome={connections.some((c) => c.stats.payments > 0)} hasId={identity?.status === "verified" || bankIds.some((b) => b.matchesAccount)} />
          <section aria-labelledby="work-h" className="space-y-3">
            <h2 id="work-h" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proof of work</h2>
            <FigmaCard key={figma?.id ?? "none"} connection={figma} oauth={me.figmaOAuth} onChange={changed} onError={onError} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WORK_SOURCES.map((spec) => (
                <SourceCard key={spec.provider} spec={spec} connections={connections.filter((c) => c.provider === spec.provider)} setup={me.setup} onChange={changed} onError={onError} />
              ))}
            </div>
          </section>
          <section aria-labelledby="money-h" className="space-y-3">
            <h2 id="money-h" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proof of income</h2>
            {MONEY_SOURCES.map((spec) => (
              <SourceCard key={spec.provider} spec={spec} connections={connections.filter((c) => c.provider === spec.provider)} setup={me.setup} onChange={changed} onError={onError} />
            ))}
            <WalletsCard wallets={wallets} onChange={changed} onError={onError} />
          </section>
          <section aria-labelledby="id-h" className="space-y-3">
            <h2 id="id-h" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proof of identity</h2>
            <BankIdCard banks={bankIds} setup={me.setup} onError={onError} />
            <IdCheckCard identity={identity} onChange={changed} />
          </section>
          <section aria-labelledby="share-h" className="space-y-3">
            <h2 id="share-h" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Apply for credit</h2>
            <ShareCard onChange={changed} onError={onError} refreshKey={tick} />
          </section>
        </div>

        <section aria-labelledby="bts-h" className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 id="bts-h" className="font-display text-xl font-bold">Behind the scenes</h2>
              <p className="text-sm text-muted-foreground">Every step we take with your data, live.</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowTech((x) => !x)} aria-pressed={showTech}>
              <Code2 /> {showTech ? "Hide" : "Show"} technical
            </Button>
          </div>
          <Timeline entries={timeline} connections={connections} showTech={showTech} live={connections.some((c) => c.status === "syncing")} />
        </section>
      </div>

      <ScoreDetails score={score} />
      <div className="grid grid-cols-1 gap-6">
        <WorkTable work={work} />
        <PaymentsTable payments={payments} />
      </div>
    </div>
  );
}
