"use client";

import { useMemo, useState } from "react";
import type { WorkFact, WorkSource } from "@/lib/beta/types";
import { cn } from "@/lib/utils";
import { FigmaMark, SourceMark } from "./brand-icons";

const SOURCE_NAME: Record<WorkSource, string> = { figma: "Figma", canva: "Canva", webflow: "Webflow", miro: "Miro", dribbble: "Dribbble" };
const KIND_LABEL: Record<WorkFact["kind"], string> = { version: "saved version", edit: "edit", comment: "from someone else", publish: "publish", shot: "published shot" };

interface Group {
  source: WorkSource;
  item: string;
  facts: WorkFact[];
  first: string;
  last: string;
  days: number;
  people: string[];
}

const day = (iso: string) => iso.slice(0, 10);

/** Everything read from work tools, grouped by file / site / board / design. */
export function WorkTable({ work }: { work: WorkFact[] }) {
  const [filter, setFilter] = useState<WorkSource | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const w of work) {
      const key = `${w.source}|${w.item}`;
      const g = map.get(key) ?? { source: w.source, item: w.item, facts: [], first: w.at, last: w.at, days: 0, people: [] };
      g.facts.push(w);
      if (w.at < g.first) g.first = w.at;
      if (w.at > g.last) g.last = w.at;
      if (w.person && !g.people.includes(w.person)) g.people.push(w.person);
      map.set(key, g);
    }
    for (const g of map.values()) g.days = new Set(g.facts.filter((f) => f.kind !== "comment").map((f) => day(f.at))).size;
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [work]);

  if (!work.length) return null;
  const sources = [...new Set(groups.map((g) => g.source))];
  const shown = groups.filter((g) => filter === "all" || g.source === filter);

  return (
    <section className="glass rounded-3xl p-5" aria-labelledby="work-found-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="work-found-h" className="font-display text-lg font-semibold">Work we found</h2>
          <p className="text-sm text-muted-foreground">Read from your work tools. Only dates, titles and people are stored, never the designs.</p>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by tool">
          {(["all", ...sources] as const).map((s) => (
            <button key={s} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", filter === s ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {s === "all" ? `All (${groups.length})` : SOURCE_NAME[s]}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 max-h-[28rem] space-y-2 overflow-auto">
        {shown.map((g) => {
          const key = `${g.source}|${g.item}`;
          const counts = new Map<string, number>();
          for (const f of g.facts) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
          return (
            <li key={key} className="rounded-2xl border bg-background/50">
              <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
                {g.source === "figma" ? <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/5"><FigmaMark className="size-4" /></span> : <SourceMark provider={g.source} className="size-9 !rounded-xl" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.item}</span>
                  <span className="block text-xs text-muted-foreground">
                    {SOURCE_NAME[g.source]} · {[...counts].map(([k, n]) => `${n} ${KIND_LABEL[k as WorkFact["kind"]]}${n === 1 || k === "comment" ? "" : "s"}`).join(", ")}
                    {g.people.length ? ` · with ${g.people.slice(0, 3).join(", ")}${g.people.length > 3 ? "…" : ""}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {g.days} active day{g.days === 1 ? "" : "s"}
                  <span className="block">{day(g.first)} → {day(g.last)}</span>
                </span>
              </button>
              {open === key && (
                <ul className="border-t px-3 py-2 text-xs text-muted-foreground">
                  {[...g.facts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map((f, i) => (
                    <li key={i} className="flex justify-between gap-3 py-0.5">
                      <span>{KIND_LABEL[f.kind]}{f.person ? ` · ${f.person}` : ""}</span>
                      <span className="tabular-nums">{new Date(f.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    </li>
                  ))}
                  {g.facts.length > 50 && <li className="pt-1">…and {g.facts.length - 50} more</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
