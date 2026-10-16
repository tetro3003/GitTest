"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, FileAudio, Loader2, Lock, Plus, Upload } from "lucide-react";
import { WorkDataSheet } from "@/components/borrower/work-data-sheet";
import { Input, Label } from "@/components/ui/input";
import { WeeklyActivityChart } from "@/components/charts/activity-chart";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EvidenceList, IncomeCoverageBar, itemStatsText, PointsLegend, SensorTotals, WorkStatusBadge } from "@/components/work-check";
import { api } from "@/lib/api";
import { analyzeLessonAudio } from "@/lib/checker/audio";
import { CHANNEL_LABEL, checkerFor, sourceDefFor, type CheckerSourceDef } from "@/lib/checker/profiles";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { isActivitySource } from "@/lib/mock/sources";
import { useDemo } from "@/lib/store";
import type { DataSource, WorkItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function WorkChecker() {
  const { personaId, invalidate } = useDemo();
  const { data, error, loading, reload } = useApi(() => api.getProfile(personaId), [personaId]);
  const [connecting, setConnecting] = useState<DataSource | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      invalidate();
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
      </div>
    );
  if (!data) return null;

  const { borrower, report, activity, workItems } = data;
  const checker = checkerFor(borrower.workType);
  const w = report.workCheck;
  const workSources = borrower.connectedSources.filter((s) => isActivitySource(s.type));
  const defFor = (s: DataSource): CheckerSourceDef | undefined => sourceDefFor(s.provider, s.type);


  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Work Checker · {checker.label}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Does your work back up your income?</h1>
        <p className="mt-1 text-muted-foreground">We look at the apps you work in and check that the work is real and big enough for what you earn.</p>
      </div>

      <Card className={cn(w.status === "mismatch" && "border-risk/40", w.status === "strong" && "border-positive/40")}>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <WorkStatusBadge status={w.status} points={w.points} />
            {w.sourcesUsed.length > 0 && <span className="text-xs text-muted-foreground">From {w.sourcesUsed.join(", ")}</span>}
          </div>
          <p className="text-sm">{w.summary}</p>
          <IncomeCoverageBar result={w} />
        </CardContent>
      </Card>

      {w.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What we checked</CardTitle>
            <CardDescription>Based on your last 12 weeks{report.features.seasonal ? " of working season" : ""}.</CardDescription>
          </CardHeader>
          <CardContent>
            <EvidenceList lines={w.evidence} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3" aria-labelledby="apps">
        <h2 id="apps" className="font-display text-lg font-semibold">
          Your work apps
        </h2>
        {!workSources.length && <p className="text-sm text-muted-foreground">No work apps are listed for this profession yet — add the apps you use below.</p>}
        {workSources.map((s) => {
          const def = defFor(s);
          const connected = s.status === "connected";
          const items = workItems.filter((i) => i.sourceId === s.id);
          return (
            <Card key={s.id} className={cn("p-4", connected && "border-positive/30")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{s.provider}</p>
                    {def?.signalsOnly && <Badge variant="muted">Pilot hardware</Badge>}
                    {connected && (
                      <Badge variant="positive">
                        <Check /> Connected
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{def?.how}</p>
                  {connected && <EvidenceLine source={s} />}
                  {def && (
                    <p className="mt-1.5 flex flex-wrap gap-1">
                      {def.channels.map((c) => (
                        <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {CHANNEL_LABEL[c]}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {s.type !== "lesson_audio" && (
                    <Button size="sm" variant={connected ? "outline" : "default"} onClick={() => setConnecting(s)}>
                      {connected ? "Update data" : "Add work data"}
                    </Button>
                  )}
                  {s.type === "lesson_audio" && !connected && (
                    <Button size="sm" disabled={busy === s.id} onClick={() => run(s.id, () => api.connectSource(personaId, s.id))}>
                      Turn on
                    </Button>
                  )}
                  {connected && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" disabled={busy === s.id} onClick={() => run(s.id, () => api.disconnectSource(personaId, s.id))}>
                      {busy === s.id && <Loader2 className="animate-spin" />} Disconnect
                    </Button>
                  )}
                </div>
              </div>

              {connected && def?.items && items.length > 0 && (
                <div className="mt-3 rounded-lg border">
                  <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Choose which {def.items} the checker can see</p>
                  <ul className="divide-y">
                    {items.map((it) => (
                      <ItemRow key={it.id} item={it} busy={busy === it.id} onToggle={(v) => run(it.id, () => api.setWorkItemShared(personaId, it.id, v))} />
                    ))}
                  </ul>
                </div>
              )}

              {connected && s.type === "lesson_audio" && <AudioUpload sourceId={s.id} />}
              {connected && s.type === "salon_sensors" && (
                <div className="mt-3">
                  <SensorTotals activity={activity} sourceId={s.id} />
                </div>
              )}
            </Card>
          );
        })}
        <AddOtherApp onAdded={(src) => setConnecting(src)} />
      </section>

      {activity.length > 0 && <WeeklyActivityChart activity={activity} weeks={26} title="Your working hours" />}

      <Card>
        <CardHeader>
          <CardTitle>How it affects your score</CardTitle>
          <CardDescription>Sharing is always better than hiding: not connecting costs more than weak evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <PointsLegend />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/borrower/profile" className="underline underline-offset-4">
          Back to my profile
        </Link>
      </p>

      <WorkDataSheet source={connecting} onClose={() => setConnecting(null)} />
    </div>
  );

}

function ItemRow({ item, busy: rowBusy, onToggle }: { item: WorkItem; busy: boolean; onToggle: (v: boolean) => void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox checked={item.shared} disabled={rowBusy} onCheckedChange={(v) => onToggle(v === true)} aria-label={`Share ${item.name}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.name}</span>
        <span className="block text-xs text-muted-foreground">
          {itemStatsText(item.stats) || "No activity yet"} · last activity {formatDate(item.lastActivity)}
        </span>
      </span>
      {rowBusy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </li>
  );
}

function AudioUpload({ sourceId }: { sourceId: string }) {
  const { personaId, invalidate } = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "analysing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (sample: { name: string; recordedMinutes: number; speechMinutes: number }) => {
    await api.uploadLessonRecording(personaId, sourceId, sample);
    setState("done");
    setMsg(`${sample.name}: ${sample.recordedMinutes} min recorded, ${sample.speechMinutes} min of teaching detected.`);
    invalidate();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setState("analysing");
    try {
      await submit(await analyzeLessonAudio(f));
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-dashed p-3">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" /> The recording is analysed on your phone. We only receive its length and how many minutes contained speech — never the audio or what was said.
      </p>
      <div className="flex flex-wrap gap-2">
        <input ref={input} id="lesson-audio" type="file" accept="audio/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={state === "analysing"}>
          {state === "analysing" ? <Loader2 className="animate-spin" /> : <Upload />} Upload a lesson recording
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={state === "analysing"}
          onClick={() => {
            setState("analysing");
            void submit({ name: "Sample home lesson (demo)", recordedMinutes: 58, speechMinutes: 44 });
          }}
        >
          <FileAudio /> Use a sample recording
        </Button>
      </div>
      {msg && (
        <p role="status" className={cn("text-sm", state === "error" ? "text-risk" : "text-positive")}>
          {msg}
        </p>
      )}
    </div>
  );
}

function EvidenceLine({ source }: { source: DataSource }) {
  const e = source.evidence;
  return (
    <p className="mt-1.5 text-xs">
      {e ? (
        <span className="text-positive">
          Real data · {CHANNEL_LABEL[e.channel]} · {e.label} · {e.events.toLocaleString("en-US")} records{e.from && e.to ? ` · ${formatDate(e.from)} – ${formatDate(e.to)}` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">Using demo data — add your own export, webhook or tracker to replace it.</span>
      )}
    </p>
  );
}

/** Universal: any app not in the list. */
function AddOtherApp({ onAdded }: { onAdded: (s: DataSource) => void }) {
  const { personaId, invalidate } = useDemo();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card className="border-dashed p-4">
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const src = await api.addCustomWorkApp(personaId, name);
            setName("");
            invalidate();
            onAdded(src);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't add the app");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label htmlFor="other-app" className="flex items-center gap-2">
          <Plus className="size-4 text-brand" /> Use another app?
        </Label>
        <p className="text-sm text-muted-foreground">Any app works: upload its export, connect it through Zapier/Make, or let the desktop tracker count your time in it.</p>
        <div className="flex gap-2">
          <Input id="other-app" placeholder="e.g. AutoCAD, Canva, Yandex Go, Calendly" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </div>
        {error && <p className="text-sm text-risk">{error}</p>}
      </form>
    </Card>
  );
}
