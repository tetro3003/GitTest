"use client";

import { Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMonth } from "@/lib/format";
import type { MonthlyIncomePoint } from "@/lib/types";
import { axisProps, ChartCard, Legend, seriesColors, TooltipBox } from "./chart-card";

/** Stacked monthly inflows by income source + the verified income line. Lender view. */
export function IncomeBySourceChart({ months, sources, verifiedMonthly }: { months: MonthlyIncomePoint[]; sources: string[]; verifiedMonthly: number }) {
  const colors = seriesColors(sources);
  const data = months.map((m) => ({ month: formatMonth(m.month, true), ...m.bySource, verified: m.verified, gross: m.gross, excluded: Math.max(0, m.gross - m.verified) }));
  const hasExcluded = data.some((d) => d.excluded > 0);
  const EXCLUDED_FILL = "url(#excluded-hatch)";
  return (
    <ChartCard
      title="Income by source"
      description={`Inflows per month, last 12 months. Hatched: money excluded from verified income (circular transfers, third-party accounts). Dashed line: conservative verified income (${formatMoney(verifiedMonthly)}).`}
      table={{
        columns: ["Month", ...sources, "Excluded", "Gross inflows", "Verified"],
        rows: months.map((m) => [formatMonth(m.month, true), ...sources.map((s) => formatMoney(m.bySource[s] ?? 0)), formatMoney(m.gross - m.verified), formatMoney(m.gross), formatMoney(m.verified)]),
      }}
    >
      <Legend
        items={[
          ...sources.map((s) => ({ label: s, color: colors[s] })),
          ...(hasExcluded ? [{ label: "Excluded (unverified)", color: "var(--risk)" }] : []),
          { label: "Verified monthly income", color: "var(--foreground)", line: true, dashed: true },
        ]}
      />
      <div className="h-64" role="img" aria-label={`Stacked bar chart of monthly income by source for ${sources.join(", ")}, with verified income of ${formatMoney(verifiedMonthly)} per month`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <pattern id="excluded-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--risk-soft)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--risk)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axisProps} width={48} tickFormatter={(v: number) => formatMoney(v, { compact: true })} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    items={[
                      ...sources.map((s) => ({ label: s, value: formatMoney(Number((payload[0].payload as Record<string, number>)[s] ?? 0)), color: colors[s] })),
                      ...(hasExcluded ? [{ label: "Excluded (unverified)", value: formatMoney(Number((payload[0].payload as Record<string, number>).excluded)), color: "var(--risk)" }] : []),
                      { label: "Verified this month", value: formatMoney(Number((payload[0].payload as Record<string, number>).verified)) },
                    ]}
                  />
                ) : null
              }
            />
            {sources.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="income" fill={colors[s]} stroke="var(--card)" strokeWidth={1} radius={i === sources.length - 1 && !hasExcluded ? [4, 4, 0, 0] : 0} maxBarSize={36} />
            ))}
            {hasExcluded && <Bar dataKey="excluded" stackId="income" fill={EXCLUDED_FILL} stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={36} />}
            <ReferenceLine y={verifiedMonthly} stroke="var(--foreground)" strokeWidth={2} strokeDasharray="5 4" ifOverflow="extendDomain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Single-series monthly verified income, for the borrower. */
export function BorrowerIncomeChart({ months }: { months: MonthlyIncomePoint[] }) {
  const data = months.map((m) => ({ month: formatMonth(m.month), full: formatMonth(m.month, true), verified: m.verified }));
  return (
    <ChartCard
      title="Your verified income"
      description="What we could confirm landed in your accounts each month."
      table={{ columns: ["Month", "Verified income"], rows: months.map((m) => [formatMonth(m.month, true), formatMoney(m.verified)]) }}
    >
      <div className="h-52" role="img" aria-label="Bar chart of your verified monthly income over the last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" {...axisProps} interval={1} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => formatMoney(v, { compact: true })} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String((payload[0].payload as { full: string }).full)}
                    items={[{ label: "Verified", value: formatMoney(Number(payload[0].value)), color: "var(--chart-1)" }]}
                  />
                ) : null
              }
            />
            <Bar dataKey="verified" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
