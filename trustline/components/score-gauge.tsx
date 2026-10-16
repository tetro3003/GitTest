"use client";

import { useEffect, useState } from "react";
import { SCORING_CONFIG } from "@/lib/config";
import { BAND_META } from "@/lib/format";
import type { Band } from "@/lib/types";
import { cn } from "@/lib/utils";

const MIN = SCORING_CONFIG.minScore;
const MAX = SCORING_CONFIG.maxScore;
const SEGMENTS: { band: Band; from: number; to: number }[] = [
  { band: "E", from: MIN, to: SCORING_CONFIG.bands.D },
  { band: "D", from: SCORING_CONFIG.bands.D, to: SCORING_CONFIG.bands.C },
  { band: "C", from: SCORING_CONFIG.bands.C, to: SCORING_CONFIG.bands.B },
  { band: "B", from: SCORING_CONFIG.bands.B, to: SCORING_CONFIG.bands.A },
  { band: "A", from: SCORING_CONFIG.bands.A, to: MAX },
];

const R = 80;
const CX = 100;
const CY = 96;

function point(score: number, r = R) {
  const t = (score - MIN) / (MAX - MIN);
  const angle = Math.PI * (1 - t);
  return { x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle) };
}

function arc(from: number, to: number, r = R) {
  const a = point(from, r);
  const b = point(to, r);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}

/** Animated semicircle score gauge. Bands are labelled, not colour-only. */
export function ScoreGauge({ score, band, size = "md", caption }: { score: number; band: Band; size?: "sm" | "md" | "lg"; caption?: string }) {
  const [shown, setShown] = useState<number>(MIN);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(MIN + (score - MIN) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const tip = point(Math.max(MIN + 1, shown));
  const meta = BAND_META[band];
  return (
    <figure
      className={cn("relative mx-auto", size === "sm" ? "w-36" : size === "lg" ? "w-72" : "w-56")}
      role="img"
      aria-label={`Score ${score} out of ${MAX}, band ${band} (${meta.label})`}
    >
      <svg viewBox="0 0 200 112" className="w-full overflow-visible">
        {SEGMENTS.map((s) => (
          <path key={s.band} d={arc(s.from + 2, s.to - 2)} fill="none" stroke={BAND_META[s.band].color} strokeOpacity={0.22} strokeWidth={14} strokeLinecap="butt" />
        ))}
        <path d={arc(MIN, Math.max(MIN + 1, shown))} fill="none" stroke={meta.color} strokeWidth={14} strokeLinecap="round" />
        <circle cx={tip.x} cy={tip.y} r={9} fill="var(--card)" stroke={meta.color} strokeWidth={3} />
        {size !== "sm" &&
          SEGMENTS.map((s) => {
            const p = point((s.from + s.to) / 2, R + 20);
            return (
              <text key={s.band} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[9px] font-medium">
                {s.band}
              </text>
            );
          })}
      </svg>
      <figcaption className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className={cn("tabular font-display font-semibold leading-none tracking-tight", size === "sm" ? "text-3xl" : size === "lg" ? "text-6xl" : "text-5xl")}>{shown}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          {caption ?? (
            <>
              Band <strong className="text-foreground">{band}</strong> · {meta.label}
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
