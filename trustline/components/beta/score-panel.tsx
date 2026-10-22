"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import type { BetaScore } from "@/lib/beta/types";
import { cn } from "@/lib/utils";

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const BAND_TEXT: Record<string, string> = { A: "Excellent", B: "Good", C: "Fair", D: "Weak", E: "High risk" };

/** Animated ring gauge for the always-dark hero. */
function Ring({ score, band }: { score: number | null; band: string | null }) {
  const [shown, setShown] = useState(300);
  useEffect(() => {
    if (score == null) return;
    const start = performance.now();
    const from = 300;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1100);
      setShown(Math.round(from + (score - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const r = 78;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° gauge
  const t = score == null ? 0 : (shown - 300) / 550;
  return (
    <div className="relative size-52 shrink-0" role="img" aria-label={score == null ? "No score yet" : `Score ${score}, band ${band}`}>
      <svg viewBox="0 0 200 200" className="size-full rotate-[135deg]">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="0.55" stopColor="#818cf8" />
            <stop offset="1" stopColor="#f472b6" />
          </linearGradient>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * arc} ${c}`} />
        {score != null && (
          <>
            <circle cx="100" cy="100" r={r} fill="none" stroke="url(#ring)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * arc * t} ${c}`} filter="url(#glow)" opacity="0.6" />
            <circle cx="100" cy="100" r={r} fill="none" stroke="url(#ring)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${c * arc * t} ${c}`} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-extrabold tabular-nums tracking-tight">{score == null ? "—" : shown}</span>
        {band ? (
          <span className="mt-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold">Band {band} · {BAND_TEXT[band]}</span>
        ) : (
          <span className="mt-1 text-xs night-muted">not enough proof yet</span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
      <p className="text-xs night-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] night-muted">{hint}</p>}
    </div>
  );
}

export function ScoreHero({ score, hasWork, hasIncome, hasId }: { score: BetaScore | null; hasWork: boolean; hasIncome: boolean; hasId: boolean }) {
  const ready = !!score?.ready && score.score != null;
  return (
    <section className="night relative overflow-hidden rounded-3xl p-6 sm:p-8" aria-labelledby="score-h">
      <h2 id="score-h" className="sr-only">Your score</h2>
      <div className="flex flex-col gap-8 md:flex-row md:items-center">
        <Ring score={ready ? score!.score : null} band={ready ? score!.band : null} />
        <div className="min-w-0 flex-1">
          {ready ? (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300"><ShieldCheck className="size-3.5" /> Verified at source</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Verified income / month" value={usd(score!.verifiedMonthlyIncome)} hint="Typical of last 6 months" />
                <Stat label="Safe monthly payment" value={usd(score!.maxMonthlyPayment)} hint="30% until bank data is in" />
                <Stat label="Paying clients" value={String(score!.features.distinctPayers ?? 0)} hint="Last 12 months" />
                <Stat label="Active design weeks" value={`${score!.features.activeWeeksLast12 ?? 0}/12`} hint={`From ${score!.features.workTools ?? 0} work tool${score!.features.workTools === 1 ? "" : "s"}`} />
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold">Unlock your score</p>
              <p className="mt-1 text-sm night-muted">We only score what we can prove:</p>
              <ol className="mt-5 space-y-3">
                {[
                  { done: hasWork, title: "Connect a work tool: Figma, Canva, Webflow or Miro", sub: "Proves the work is real" },
                  { done: hasIncome, title: "Connect where clients pay you: Gmail, Wise, bank or a wallet", sub: "Proves the money is real" },
                  { done: hasId, title: "Confirm who you are: with your bank, or the ID check", sub: "Proves the income is yours (adds points; not required to see a score)" },
                ].map((s, i) => (
                  <li key={s.title} className="flex items-center gap-3">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold", s.done ? "border-emerald-400 bg-emerald-400 text-[#06281f]" : "border-white/25")}>{s.done ? <Check className="size-4" /> : i + 1}</span>
                    <span>
                      <span className={cn("block text-sm font-semibold", s.done && "line-through decoration-white/40")}>{s.title}</span>
                      <span className="block text-xs night-muted">{s.sub}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
      {ready &&
        score!.flags.map((f) => (
          <p key={f.id} className={cn("mt-5 flex gap-2 rounded-2xl p-3 text-sm", f.severity === "high" ? "bg-rose-500/15 text-rose-200" : "bg-amber-400/15 text-amber-100")}>
            <AlertTriangle className="size-4 shrink-0" /> <span><strong>{f.title}.</strong> {f.detail}</span>
          </p>
        ))}
    </section>
  );
}

/** Reasons and the 12-month income vs work chart. */
export function ScoreDetails({ score }: { score: BetaScore | null }) {
  if (!score?.ready) return null;
  const maxImpact = Math.max(1, ...score.reasons.map((r) => Math.abs(r.impact)));
  const maxIncome = Math.max(1, ...score.months.map((m) => m.income));
  const maxHours = Math.max(1, ...score.months.map((m) => m.workHours));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="glass rounded-3xl p-5" aria-labelledby="why-h">
        <h3 id="why-h" className="font-display font-semibold">Why this score</h3>
        <p className="text-xs text-muted-foreground">Starts at 500. Each factor adds or removes points.</p>
        <ul className="mt-4 space-y-3">
          {score.reasons.map((r) => (
            <li key={r.id} title={r.plain}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{r.label}</span>
                <span className={cn("font-mono text-xs font-semibold tabular-nums", r.impact > 0 ? "text-positive" : r.impact < 0 ? "text-risk" : "text-muted-foreground")}>{r.impact > 0 ? `+${r.impact}` : r.impact}</span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-muted">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <span
                  className={cn("absolute inset-y-0 rounded-full", r.impact >= 0 ? "left-1/2 bg-gradient-to-r from-teal-400 to-emerald-500" : "right-1/2 bg-gradient-to-l from-rose-400 to-rose-500")}
                  style={{ width: `${(Math.abs(r.impact) / maxImpact) * 50}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.plain}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="glass rounded-3xl p-5" aria-labelledby="chart-h">
        <h3 id="chart-h" className="font-display font-semibold">Money vs. work</h3>
        <p className="text-xs text-muted-foreground">Real income should line up with real design hours.</p>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-gradient-to-t from-teal-500 to-teal-300" /> Verified income</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-gradient-to-t from-indigo-500 to-violet-300" /> Design hours</span>
        </div>
        <div className="mt-4 grid h-48 grid-cols-12 items-end gap-1.5" role="img" aria-label="Monthly verified income and design hours, last 12 months">
          {score.months.map((m) => (
            <div key={m.month} className="flex h-full flex-col justify-end" title={`${m.month}: ${usd(m.income)} · ${m.workHours} h`}>
              <div className="flex h-full items-end gap-0.5">
                <span className="flex-1 rounded-full bg-gradient-to-t from-teal-500 to-teal-300 transition-[height] duration-700" style={{ height: `${Math.max(2, (m.income / maxIncome) * 100)}%` }} />
                <span className="flex-1 rounded-full bg-gradient-to-t from-indigo-500 to-violet-300 transition-[height] duration-700" style={{ height: `${Math.max(2, (m.workHours / maxHours) * 100)}%` }} />
              </div>
              <span className="mt-1.5 text-center text-[10px] text-muted-foreground">{new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString("en", { month: "narrow", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
