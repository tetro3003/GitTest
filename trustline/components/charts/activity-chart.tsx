"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { ActivityRecord, MonthlyIncomePoint } from "@/lib/types";
import { axisProps, ChartCard, Legend, TooltipBox } from "./chart-card";

/** Weekly hours online — single series. */
export function WeeklyActivityChart({ activity, weeks = 26, title = "Weekly work activity" }: { activity: ActivityRecord[]; weeks?: number; title?: string }) {
  const rows = activity.slice(-weeks);
  const data = rows.map((a) => ({ week: formatDate(a.weekStart).replace(/ \d{4}$/, ""), hours: a.hoursOnline, trips: a.tripsOrOrders, rating: a.rating }));
  return (
    <ChartCard
      title={title}
      description={`Hours online per week, last ${rows.length} weeks.`}
      table={{ columns: ["Week of", "Hours", "Trips / orders", "Rating"], rows: rows.map((a) => [formatDate(a.weekStart), a.hoursOnline, a.tripsOrOrders, a.rating ?? "—"]) }}
    >
      <div className="h-48" role="img" aria-label={`Bar chart of weekly hours online over the last ${rows.length} weeks`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="week" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axisProps} width={32} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={`Week of ${p.week}`}
                    items={[
                      { label: "Hours online", value: String(p.hours), color: "var(--chart-3)" },
                      { label: "Trips / orders", value: String(p.trips) },
                      ...(p.rating ? [{ label: "Rating", value: p.rating.toFixed(2) }] : []),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="hours" fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/**
 * Hours vs income on ONE axis: both indexed to their 12-month average (=100),
 * so the leading-indicator relationship is visible without a dual axis.
 */
export function ActivityIncomeIndexChart({ months }: { months: MonthlyIncomePoint[] }) {
  const withHours = months.filter((m) => m.hours !== null);
  const avgH = withHours.reduce((a, m) => a + (m.hours ?? 0), 0) / Math.max(1, withHours.length);
  const avgI = months.reduce((a, m) => a + m.verified, 0) / Math.max(1, months.length);
  const data = months.map((m) => ({
    month: formatMonth(m.month, true),
    hoursIdx: m.hours !== null && avgH > 0 ? Math.round(((m.hours ?? 0) / avgH) * 100) : null,
    incomeIdx: avgI > 0 ? Math.round((m.verified / avgI) * 100) : 0,
    hours: m.hours,
    income: m.verified,
  }));
  return (
    <ChartCard
      title="Activity vs income"
      description="Both indexed to their 12-month average (= 100). Hours online move first; income follows."
      table={{ columns: ["Month", "Hours online", "Hours index", "Verified income", "Income index"], rows: data.map((d) => [d.month, d.hours ?? "—", d.hoursIdx ?? "—", formatMoney(d.income), d.incomeIdx]) }}
    >
      <Legend
        items={[
          { label: "Hours online (index)", color: "var(--chart-3)", line: true },
          { label: "Verified income (index)", color: "var(--chart-1)", line: true },
        ]}
      />
      <div className="h-56" role="img" aria-label="Line chart comparing indexed monthly hours online with indexed verified income">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axisProps} width={36} domain={[0, "auto"]} />
            <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={p.month}
                    items={[
                      { label: "Hours online", value: `${p.hours ?? "—"} (${p.hoursIdx ?? "—"})`, color: "var(--chart-3)" },
                      { label: "Verified income", value: `${formatMoney(p.income)} (${p.incomeIdx})`, color: "var(--chart-1)" },
                    ]}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="hoursIdx" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} connectNulls />
            <Line type="monotone" dataKey="incomeIdx" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
