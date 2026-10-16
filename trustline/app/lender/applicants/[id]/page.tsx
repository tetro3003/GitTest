"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Download, Radar, Settings2 } from "lucide-react";
import { BandBadge, DecisionBadge } from "@/components/badges";
import { ActivityIncomeIndexChart, WeeklyActivityChart } from "@/components/charts/activity-chart";
import { IncomeBySourceChart } from "@/components/charts/income-chart";
import { ScoreWaterfall } from "@/components/charts/waterfall-chart";
import { FraudPanel } from "@/components/lender/fraud-panel";
import { ReasonsTable } from "@/components/lender/reasons-table";
import { TransactionsTable } from "@/components/lender/transactions-table";
import { FeaturesCard } from "@/components/lender/features-card";
import { WorkCheckPanel } from "@/components/lender/work-check-panel";
import { ScoreGauge } from "@/components/score-gauge";
import { CardSkeleton, ChartSkeleton, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { DECISION_THRESHOLDS } from "@/lib/config";
import { formatMoney, signed, WORK_TYPE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { SOURCE_TYPE_LABEL } from "@/lib/mock/sources";
import { suggestDecision } from "@/lib/scoring";

export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi(() => api.getApplicant(id), [id]);
  const [approveMin, setApproveMin] = useState<number>(DECISION_THRESHOLDS.approveMinScore);
  const [declineBelow, setDeclineBelow] = useState<number>(DECISION_THRESHOLDS.declineBelowScore);
  const [policyOpen, setPolicyOpen] = useState(false);

  const flaggedIds = useMemo(() => new Set(data?.report.fraudFlags.flatMap((f) => f.transactionIds) ?? []), [data]);

  if (error)
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  if (loading && !data)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <CardSkeleton lines={1} />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} className="lg:col-span-2" />
        </div>
        <ChartSkeleton />
      </div>
    );
  if (!data) return null;

  const { borrower, report, transactions, activity, invoices } = data;
  const decision = report.dataSufficiency === "insufficient" ? "review" : suggestDecision(report.score, report.fraudFlags, { approveMinScore: approveMin, declineBelowScore: declineBelow, declineHighFlags: DECISION_THRESHOLDS.declineHighFlags });
  const connected = borrower.connectedSources.filter((s) => s.status === "connected");
  const hasActivity = report.features.hasActivityData;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/lender" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Applicants
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">{borrower.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {WORK_TYPE_LABEL[borrower.workType]} · {borrower.city}
            {borrower.kycStatus === "verified" && (
              <Badge variant="positive">
                <BadgeCheck /> KYC verified
              </Badge>
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/lender/applicants/${id}/report`} target="_blank">
            <Download /> Download report
          </Link>
        </Button>
      </div>

      {/* Header KPIs */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col items-center justify-center p-6">
          <ScoreGauge score={report.score} band={report.band} />
          {report.bandCapped && (
            <p className="mt-3 text-center text-xs text-risk">Capped from {report.uncappedScore} by high-severity fraud flags</p>
          )}
          {report.workCheck.status !== "not_supported" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radar className="size-3.5 text-brand" /> Work Checker {signed(report.workCheckPoints)} · {report.scoreWithoutActivity} if not shared
            </p>
          )}
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs text-muted-foreground">Verified monthly income</p>
            <p className="tabular mt-1 font-display text-3xl font-semibold">{formatMoney(report.verifiedMonthlyIncome)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.features.seasonal ? "12-month average (seasonal earner)" : "6-month weighted median"} · gross {formatMoney(report.features.grossMonthlyIncome)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground">Recommended max payment</p>
            <p className="tabular mt-1 font-display text-3xl font-semibold">{formatMoney(report.recommendedMaxPayment)}</p>
            <p className="mt-1 text-xs text-muted-foreground">40% of free cash flow ({formatMoney(report.features.freeCashFlow)})</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground">Band</p>
            <div className="mt-2">
              <BandBadge band={report.band} showLabel className="text-base" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {report.features.tenureMonths} months history · {report.fraudFlags.length} flag(s)
            </p>
          </Card>
          <Card className="relative p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Decision suggestion</p>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={() => setPolicyOpen((o) => !o)} aria-label="Edit decision thresholds" aria-expanded={policyOpen}>
                <Settings2 className="size-4" />
              </button>
            </div>
            <div className="mt-2">
              <DecisionBadge decision={decision} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Approve ≥ {approveMin} · decline &lt; {declineBelow}
            </p>
            {policyOpen && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <div className="space-y-1">
                  <Label htmlFor="approveMin" className="text-xs">Approve from</Label>
                  <Input id="approveMin" type="number" min={300} max={850} value={approveMin} onChange={(e) => setApproveMin(Number(e.target.value))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="declineBelow" className="text-xs">Decline below</Label>
                  <Input id="declineBelow" type="number" min={300} max={850} value={declineBelow} onChange={(e) => setDeclineBelow(Number(e.target.value))} className="h-8" />
                </div>
              </div>
            )}
          </Card>
          <Card className="p-5 sm:col-span-2 xl:col-span-4">
            <p className="mb-2 text-xs text-muted-foreground">Connected sources</p>
            <div className="flex flex-wrap gap-2">
              {connected.map((s) => (
                <Badge key={s.id} variant={s.tier === 3 ? "default" : "outline"}>
                  {s.provider} · {SOURCE_TYPE_LABEL[s.type]}
                </Badge>
              ))}
              {!connected.length && <span className="text-sm text-muted-foreground">None — the applicant revoked all sources.</span>}
            </div>
          </Card>
        </div>
      </div>

      {report.dataSufficiency === "insufficient" ? (
        <Card className="p-8 text-center text-muted-foreground">No verified income data is currently shared by this applicant.</Card>
      ) : (
        <>
          <IncomeBySourceChart months={report.monthlyIncome} sources={report.incomeSources} verifiedMonthly={report.verifiedMonthlyIncome} />

          <WorkCheckPanel result={report.workCheck} items={data.workItems} activity={activity} sources={borrower.connectedSources} />

          {hasActivity && (
            <div className="grid gap-4 xl:grid-cols-2">
              <ActivityIncomeIndexChart months={report.monthlyIncome} />
              <WeeklyActivityChart activity={activity} />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <ScoreWaterfall report={report} />
            <ReasonsTable report={report} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <FraudPanel flags={report.fraudFlags} warnings={report.earlyWarnings} transactions={transactions} invoices={invoices} />
            <FeaturesCard report={report} />
          </div>

          <TransactionsTable transactions={transactions} sources={borrower.connectedSources} flaggedIds={flaggedIds} />
        </>
      )}
    </div>
  );
}
