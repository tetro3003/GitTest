"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Bike, CalendarCheck, Car, Check, Clock, Code2, FileText, Loader2, Lock, Mic, PenTool, Radar, Smartphone, Video, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CardSkeleton, ErrorState } from "@/components/states";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { SOURCE_TYPE_LABEL } from "@/lib/mock/sources";
import { useDemo } from "@/lib/store";
import type { DataSource, SourceTier, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<SourceType, typeof Car> = {
  bank: Banknote,
  ride_hailing: Car,
  delivery_platform: Bike,
  design_tool: PenTool,
  dev_tool: Code2,
  video_lessons: Video,
  lesson_audio: Mic,
  booking_app: CalendarCheck,
  salon_sensors: Radar,
  utility: Zap,
  mobile_operator: Smartphone,
  invoice_upload: FileText,
};

const TIERS: Record<SourceTier, { title: string; body: string }> = {
  1: { title: "Verified money", body: "Where your income actually lands. At least one bank account is needed." },
  2: { title: "Payment behaviour", body: "Shows you pay bills on time." },
  3: { title: "Work evidence", body: "The Work Checker uses these to confirm your work is real. Strong evidence adds up to +50; sharing nothing costs 30 points." },
};

export default function ConnectSources() {
  const { personaId, invalidate } = useDemo();
  const { data, error, loading, reload } = useApi(() => api.listSources(personaId), [personaId]);
  const [active, setActive] = useState<DataSource | null>(null);
  const [phase, setPhase] = useState<"consent" | "connecting" | "done" | "error">("consent");
  const [busyId, setBusyId] = useState<string | null>(null);

  const openConnect = (s: DataSource) => {
    setActive(s);
    setPhase("consent");
  };

  const authorize = async () => {
    if (!active) return;
    setPhase("connecting");
    try {
      await api.connectSource(personaId, active.id);
      setPhase("done");
      invalidate();
    } catch {
      setPhase("error");
    }
  };

  const disconnect = async (s: DataSource) => {
    setBusyId(s.id);
    try {
      await api.disconnectSource(personaId, s.id);
      invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const hasBank = data?.some((s) => s.type === "bank" && s.status === "connected");
  const connectedCount = data?.filter((s) => s.status === "connected").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Connect your income sources</h1>
        <p className="mt-1 text-muted-foreground">Read-only access. You choose what to share and can revoke anytime.</p>
      </div>

      {loading && !data && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data &&
        ([1, 2, 3] as SourceTier[]).map((tier) => {
          const items = data.filter((s) => s.tier === tier);
          if (!items.length) return null;
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                <h2 id={`tier-${tier}`} className="font-display text-lg font-semibold">
                  Tier {tier} · {TIERS[tier].title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {TIERS[tier].body}
                  {tier === 3 && (
                    <>
                      {" "}
                      <Link href="/borrower/work" className="font-medium text-brand underline-offset-4 hover:underline">
                        Open Work Checker
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <ul className="space-y-3">
                {items.map((s) => {
                  const Icon = ICONS[s.type];
                  const connected = s.status === "connected";
                  return (
                    <li key={s.id}>
                      <Card className={cn("p-4", connected && "border-positive/40")}>
                        <div className="flex items-start gap-3">
                          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", connected ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground")}>
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{s.provider}</p>
                              <span className="text-sm text-muted-foreground">{SOURCE_TYPE_LABEL[s.type]}</span>
                              {s.optional && (
                                <Badge variant="default">
                                  <Radar /> Work Checker
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">Shares: {s.dataShared.join(" · ")}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" /> Access for {s.consentDays} days
                            </p>
                          </div>
                          <div className="shrink-0">
                            {connected ? (
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="positive">
                                  <Check /> Connected
                                </Badge>
                                <Button variant="link" size="sm" className="h-auto text-xs text-muted-foreground" onClick={() => disconnect(s)} disabled={busyId === s.id}>
                                  {busyId === s.id ? "Disconnecting…" : "Disconnect"}
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant={s.optional ? "outline" : "default"} onClick={() => openConnect(s)}>
                                Connect
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

      {data && (
        <Card className="sticky bottom-20 flex flex-col gap-3 p-4 shadow-lg sm:bottom-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <strong>{connectedCount}</strong> source{connectedCount === 1 ? "" : "s"} connected
            {!hasBank && <span className="text-muted-foreground"> · connect a bank account to continue</span>}
          </p>
          {hasBank ? (
            <Button asChild>
              <Link href="/borrower/analyzing">
                Build my profile <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button disabled>
              Build my profile <ArrowRight />
            </Button>
          )}
        </Card>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && phase !== "connecting" && setActive(null)}>
        <DialogContent>
          {active && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {(() => {
                    const I = ICONS[active.type];
                    return <I className="size-5" />;
                  })()}
                </span>
                <div>
                  <DialogTitle>Connect {active.provider}</DialogTitle>
                  <DialogDescription>You&apos;ll be redirected to {active.provider} to approve read-only access.</DialogDescription>
                </div>
              </div>

              {phase === "consent" && (
                <>
                  <div className="rounded-xl bg-muted/60 p-4 text-sm">
                    <p className="mb-2 font-medium">{active.provider} will share:</p>
                    <ul className="space-y-1.5">
                      {active.dataShared.map((d) => (
                        <li key={d} className="flex items-center gap-2">
                          <Check className="size-4 text-positive" /> {d}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                      <Lock className="size-4" /> Read-only · expires in {active.consentDays} days · revoke anytime
                    </p>
                  </div>
                  {active.optional && (
                    <p className="rounded-xl border border-brand/30 bg-brand-soft p-3 text-sm">
                      The <strong>Work Checker</strong> uses this to confirm your work backs up your income. Strong evidence adds up to +50 points; connecting no work app at all costs 30 points.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setActive(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={authorize}>
                      Allow access
                    </Button>
                  </div>
                </>
              )}

              {phase === "connecting" && (
                <div className="space-y-3 py-2" aria-live="polite">
                  <p className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin text-brand" /> Waiting for {active.provider} to confirm…
                  </p>
                  <IndeterminateBar />
                </div>
              )}

              {phase === "done" && (
                <div className="space-y-4" aria-live="polite">
                  <p className="flex items-center gap-2 rounded-xl bg-positive-soft p-3 text-sm font-medium text-positive">
                    <Check className="size-4" /> {active.provider} connected
                  </p>
                  <Button className="w-full" onClick={() => setActive(null)}>
                    Done
                  </Button>
                </div>
              )}

              {phase === "error" && (
                <div className="space-y-3">
                  <p className="text-sm text-risk">The connection failed. Please try again.</p>
                  <Button className="w-full" onClick={authorize}>
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndeterminateBar() {
  return <Progress value={70} className="animate-pulse" label="Connecting" />;
}
