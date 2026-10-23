"use client";

import type { BetaConnection, TimelineActor, TimelineEntry } from "@/lib/beta/types";
import { cn } from "@/lib/utils";

const ACTOR: Record<TimelineActor, { label: string; chip: string; dot: string }> = {
  you: { label: "You", chip: "bg-sky-400/15 text-sky-300", dot: "bg-sky-400" },
  trustline: { label: "Trustline", chip: "bg-teal-400/15 text-teal-300", dot: "bg-teal-400" },
  figma: { label: "Figma", chip: "bg-orange-400/15 text-orange-300", dot: "bg-orange-400" },
  blockchain: { label: "Blockchain", chip: "bg-violet-400/15 text-violet-300", dot: "bg-violet-400" },
  robot: { label: "Daily robot", chip: "bg-fuchsia-400/15 text-fuchsia-300", dot: "bg-fuchsia-400" },
  google: { label: "Gmail", chip: "bg-red-400/15 text-red-300", dot: "bg-red-400" },
  ai: { label: "Claude AI", chip: "bg-amber-300/15 text-amber-200", dot: "bg-amber-300" },
  wise: { label: "Wise", chip: "bg-lime-400/15 text-lime-300", dot: "bg-lime-400" },
  bank: { label: "TBC Bank", chip: "bg-sky-300/15 text-sky-200", dot: "bg-sky-300" },
  canva: { label: "Canva", chip: "bg-cyan-400/15 text-cyan-300", dot: "bg-cyan-400" },
  webflow: { label: "Webflow", chip: "bg-blue-400/15 text-blue-300", dot: "bg-blue-400" },
  miro: { label: "Miro", chip: "bg-yellow-300/15 text-yellow-200", dot: "bg-yellow-300" },
  dribbble: { label: "Dribbble", chip: "bg-pink-400/15 text-pink-300", dot: "bg-pink-400" },
};

const LEVEL_DOT: Record<TimelineEntry["level"], string> = {
  step: "",
  ok: "ring-2 ring-emerald-400/50",
  warn: "!bg-amber-400 ring-2 ring-amber-400/40",
  error: "!bg-rose-500 ring-2 ring-rose-500/40",
};

/** When nothing is being read: say everything is saved and when the daily robot looks again. */
function idleLabel(connections: BetaConnection[]): string {
  const synced = connections.map((c) => c.lastSyncAt).filter((x): x is string => !!x);
  if (!connections.length) return "WAITING";
  if (!synced.length) return "UP TO DATE";
  const next = Math.min(...synced.map((t) => new Date(t).getTime() + 24 * 3600_000)) - Date.now();
  const h = Math.max(0, Math.round(next / 3600_000));
  return `UP TO DATE · NEXT CHECK ${h < 1 ? "SOON" : `IN ${h} H`}`;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

/** "Behind the scenes": a live console of every step Trustline took, grouped by action, newest first. */
export function Timeline({ entries, connections, showTech, live }: { entries: TimelineEntry[]; connections: BetaConnection[]; showTech: boolean; live: boolean }) {
  // One group per action. Actions can run at the same time, so their steps interleave: group by run, not by neighbour.
  const byRun = new Map<string, TimelineEntry[]>();
  for (const e of entries) byRun.set(e.runId, [...(byRun.get(e.runId) ?? []), e]);
  const runs = [...byRun].map(([runId, items]) => ({ runId, items })).sort((a, b) => b.items[b.items.length - 1].id - a.items[a.items.length - 1].id);

  return (
    <div className="night overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-300/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <span className="font-mono text-[11px] night-muted">trustline · activity</span>
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-emerald-300">
          {live ? <span className="live-dot" /> : <span className="size-2 rounded-full bg-emerald-300/60" />}
          {live ? "READING NOW" : idleLabel(connections)}
        </span>
      </div>

      {!runs.length ? (
        <p className="px-5 py-12 text-center font-mono text-sm night-muted">
          $ waiting for your first connection…
          <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-emerald-300/80" />
        </p>
      ) : (
        <ol className="space-y-5 p-4" aria-live="polite">
          {runs.map((r) => {
            const conn = connections.find((c) => c.id === r.items[0].connectionId);
            return (
              <li key={r.runId} className="beta-in">
                <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[11px] night-muted">
                  <span className="truncate uppercase tracking-wider">{conn?.label ?? "Account"}</span>
                  <span className="shrink-0 tabular-nums">{day(r.items[0].at)} {time(r.items[0].at)}</span>
                </div>
                <ul className="relative space-y-2.5 border-l border-white/10 pl-4">
                  {r.items.map((e) => (
                    <li key={e.id} className="beta-in relative">
                      <span className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full", ACTOR[e.actor].dot, LEVEL_DOT[e.level])} aria-hidden />
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className={cn("rounded-md px-1.5 py-px font-mono text-[10.5px] font-semibold uppercase tracking-wide", ACTOR[e.actor].chip)}>{ACTOR[e.actor].label}</span>
                        <span className={cn("text-[13.5px] leading-snug", e.level === "error" ? "text-rose-300" : e.level === "warn" ? "text-amber-200" : "text-slate-100")}>
                          {e.text}
                          {e.level === "ok" && <span className="ml-1.5 text-emerald-300">✓</span>}
                        </span>
                      </div>
                      {showTech && e.tech && <p className="mt-1 break-all font-mono text-[11px] text-teal-200/60">→ {e.tech}</p>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
