"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { signed } from "@/lib/format";
import type { ScoreReport } from "@/lib/types";
import { axisProps, ChartCard, TooltipBox } from "./chart-card";

interface Step {
  name: string;
  range: [number, number];
  delta: number;
  kind: "total" | "up" | "down";
  detail: string;
}

/** Waterfall from base score to final score; each step is one engine reason. */
export function ScoreWaterfall({ report }: { report: ScoreReport }) {
  const steps: Step[] = [{ name: "Base score", range: [0, report.baseScore], delta: report.baseScore, kind: "total", detail: "Every applicant starts here" }];
  let run = report.baseScore;
  for (const r of report.reasons.filter((x) => x.impact !== 0)) {
    steps.push({ name: r.label, range: [run, run + r.impact], delta: r.impact, kind: r.impact > 0 ? "up" : "down", detail: r.detail });
    run += r.impact;
  }
  const clampDiff = report.uncappedScore - run;
  if (clampDiff !== 0) {
    steps.push({ name: "Clamp to 300–850", range: [run, report.uncappedScore], delta: clampDiff, kind: clampDiff > 0 ? "up" : "down", detail: "Score range limit" });
    run = report.uncappedScore;
  }
  if (report.score !== report.uncappedScore) {
    steps.push({ name: "Fraud cap (high-severity flag)", range: [run, report.score], delta: report.score - run, kind: "down", detail: "High-severity flags cap the score at band D" });
  }
  steps.push({ name: "Final score", range: [0, report.score], delta: report.score, kind: "total", detail: `Band ${report.band}` });

  const lo = Math.min(...steps.filter((s) => s.kind !== "total").flatMap((s) => s.range), report.baseScore) - 40;
  const hi = Math.max(...steps.flatMap((s) => s.range)) + 30;
  const domainLo = Math.max(0, Math.floor(lo / 50) * 50);
  const data = steps.map((s) => ({ ...s, range: [Math.max(s.range[0], domainLo), s.range[1]] as [number, number], label: s.kind === "total" ? String(s.delta) : signed(s.delta) }));
  const color = (k: Step["kind"]) => (k === "total" ? "var(--chart-1)" : k === "up" ? "var(--positive)" : "var(--risk)");

  return (
    <ChartCard
      title="Score build-up"
      description={`From the base of ${report.baseScore} to ${report.score}. Green adds points, red removes them.`}
      table={{ columns: ["Step", "Points", "Running total", "Detail"], rows: steps.map((s) => [s.name, s.kind === "total" ? s.delta : signed(s.delta), s.range[1], s.detail]) }}
    >
      <div style={{ height: 34 * data.length + 40 }} role="img" aria-label={`Waterfall chart from base score ${report.baseScore} to final score ${report.score}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[domainLo, Math.ceil(hi / 50) * 50]} {...axisProps} />
            <YAxis type="category" dataKey="name" {...axisProps} width={190} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return <TooltipBox title={p.name} items={[{ label: p.kind === "total" ? "Score" : "Impact", value: p.label, color: color(p.kind) }, { label: "Detail", value: p.detail }]} />;
              }}
            />
            <Bar dataKey="range" radius={4} isAnimationActive>
              {data.map((d) => (
                <Cell key={d.name} fill={color(d.kind)} />
              ))}
              <LabelList dataKey="label" position="right" className="fill-foreground text-xs font-medium tabular" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
