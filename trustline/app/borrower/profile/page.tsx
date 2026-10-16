"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Info, Lightbulb, Link2, Radar, Send } from "lucide-react";
import { WorkStatusBadge } from "@/components/work-check";
import { cn } from "@/lib/utils";
import { BandBadge } from "@/components/badges";
import { BorrowerIncomeChart } from "@/components/charts/income-chart";
import { WeeklyActivityChart } from "@/components/charts/activity-chart";
import { PlainReasons } from "@/components/borrower/reason-list";
import { ScoreGauge } from "@/components/score-gauge";
import { CardSkeleton, ChartSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { SCORING_CONFIG } from "@/lib/config";
import { formatMoney } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useDemo } from "@/lib/store";

export default function Profile() {
  const personaId = useDemo((s) => s.personaId);
  const { data, error, loading, reload } = useApi(() => api.getProfile(personaId), [personaId]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <CardSkeleton lines={6} />
        <div className="grid grid-cols-2 gap-3">
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
        <ChartSkeleton />
      </div>
    );
  if (!data) return null;

  const { report, borrower, activity } = data;
  const first = borrower.name.split(" ")[0];

  if (report.dataSufficiency === "insufficient")
    return (
      <EmptyState
        icon={<Link2 className="size-5" />}
        title="No income data yet"
        description="Connect at least one bank account where your earnings arrive, and we'll build your profile in seconds."
        action={
          <Button asChild>
            <Link href="/borrower/connect">Connect sources</Link>
          </Button>
        }
      />
    );

  const activityShared = report.features.hasActivityData;
  const flagged = report.fraudFlags.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Hi {first} 👋</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Your income & credit profile</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-brand-soft to-transparent px-5 pb-2 pt-6">
          <ScoreGauge score={report.score} band={report.band} size="lg" />
        </div>
        <CardContent className="pt-4">
          <p className="text-center text-sm text-muted-foreground">
            Scores range from {SCORING_CONFIG.minScore} to {SCORING_CONFIG.maxScore}. <BandBadge band={report.band} showLabel />
          </p>
          {report.dataSufficiency === "limited" && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning-strong" />
              We can only see {report.features.tenureMonths} months of income so far. Your score will firm up as your history grows.
            </p>
          )}
          {flagged && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-risk-soft p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk" />
              Some of your data needs a closer look by the lender (for example, transfers that went back to the sender). This can limit your score until it&apos;s reviewed.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Verified monthly income</p>
          <p className="tabular mt-1 font-display text-2xl font-semibold sm:text-3xl">{formatMoney(report.verifiedMonthlyIncome)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Conservative, based on the last 6 months</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">You can comfortably repay</p>
          <p className="tabular mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {formatMoney(report.recommendedMaxPayment)}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{Math.round(SCORING_CONFIG.paymentToFreeCashFlowRatio * 100)}% of what&apos;s left after essentials</p>
        </Card>
      </div>

      {report.workCheck.status !== "not_supported" && (
        <Card className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", report.workCheck.points > 0 ? "border-positive/30 bg-positive-soft" : "border-warning/40 bg-warning-soft")}>
          <Radar className={cn("size-5 shrink-0", report.workCheck.points > 0 ? "text-positive" : "text-warning-strong")} />
          <div className="flex-1 space-y-1 text-sm">
            <WorkStatusBadge status={report.workCheck.status} points={report.workCheck.points} />
            <p>
              {report.workCheck.summary}
              {report.workCheck.points > 0 && report.scoreWithoutActivity !== report.score && <> Without it you&apos;d be at {report.scoreWithoutActivity}.</>}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/borrower/work">Open Work Checker</Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What helps your score</CardTitle>
          </CardHeader>
          <CardContent>
            <PlainReasons reasons={report.reasons} kind="positive" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What holds it back</CardTitle>
          </CardHeader>
          <CardContent>
            <PlainReasons reasons={report.reasons} kind="negative" />
          </CardContent>
        </Card>
      </div>

      <BorrowerIncomeChart months={report.features.tenureMonths < 12 ? report.monthlyIncome.slice(-report.features.tenureMonths) : report.monthlyIncome} />

      {activityShared && activity.length > 0 && <WeeklyActivityChart activity={activity} weeks={20} title="Your working hours" />}

      {report.improvementTips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-warning-strong" /> How to improve
            </CardTitle>
            <CardDescription>Small steps that move your score.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {report.improvementTips.map((t) => (
                <li key={t} className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand" /> {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Ready to apply?</p>
          <p className="text-sm text-muted-foreground">Share this profile with a lender — you decide what they see and for how long.</p>
        </div>
        <Button asChild>
          <Link href="/borrower/share">
            <Send /> Share with a lender
          </Link>
        </Button>
      </Card>
    </div>
  );
}
