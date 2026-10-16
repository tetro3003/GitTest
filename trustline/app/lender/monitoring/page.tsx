"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BellRing, ShieldAlert, Wallet } from "lucide-react";
import { SeverityBadge } from "@/components/badges";
import { Sparkline } from "@/components/charts/sparkline";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, WORK_TYPE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { MonitoringAlert, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Partial<Record<MonitoringAlert["type"], typeof Activity>> = {
  activity_decline: Activity,
  low_balance: Wallet,
  missed_bill: AlertTriangle,
};

export default function Monitoring() {
  const { data, error, loading, reload } = useApi(() => api.getMonitoring(), []);
  const [filter, setFilter] = useState<"all" | "warnings" | "fraud">("all");

  const isWarning = (a: MonitoringAlert) => a.type === "activity_decline" || a.type === "low_balance" || a.type === "missed_bill";
  const rows = data?.filter((a) => filter === "all" || (filter === "warnings" ? isWarning(a) : !isWarning(a)));
  const count = (s: Severity) => data?.filter((a) => a.severity === s).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">Ongoing checks on borrowers with an active consent. Work activity is a leading indicator: it drops before income does.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["high", "medium", "low"] as Severity[]).map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs capitalize text-muted-foreground">{s} severity</p>
            <p className="tabular mt-1 font-display text-2xl font-semibold">{data ? count(s) : "–"}</p>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit" role="tablist" aria-label="Alert type">
        {(["all", "warnings", "fraud"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize sm:flex-none", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}
          >
            {f === "warnings" ? "Early warnings" : f === "fraud" ? "Fraud flags" : "All alerts"}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-3">
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
      )}
      {rows && !rows.length && <EmptyState icon={<BellRing className="size-5" />} title="No alerts" description="Everything looks normal across your portfolio." />}

      <ul className="space-y-3">
        {rows?.map((a) => {
          const Icon = TYPE_ICON[a.type] ?? ShieldAlert;
          return (
            <li key={a.id}>
              <Card className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", a.severity === "high" && "border-risk/40")}>
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", a.severity === "high" ? "bg-risk-soft text-risk" : a.severity === "medium" ? "bg-warning-soft text-warning-strong" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/lender/applicants/${a.borrowerId}`} className="font-semibold hover:underline">
                      {a.borrowerName}
                    </Link>
                    <span className="text-sm text-muted-foreground">{WORK_TYPE_LABEL[a.workType]}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="mt-0.5 text-sm">{a.message}</p>
                  <p className="text-xs text-muted-foreground">Detected {formatDate(a.detectedAt)}</p>
                </div>
                {a.trend.length > 1 && (
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                    <Sparkline values={a.trend} label={`Weekly hours, last ${a.trend.length} weeks: ${a.trend.join(", ")}`} />
                    <span className="text-[11px] text-muted-foreground">hours/week, 12w</span>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
