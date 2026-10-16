"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Radar, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { WorkStatusBadge } from "@/components/work-check";
import { BandBadge, DecisionBadge } from "@/components/badges";
import { Logo } from "@/components/logo";
import { ScoreGauge } from "@/components/score-gauge";
import { CardSkeleton, ErrorState } from "@/components/states";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { bandFor } from "@/lib/scoring";
import { formatMoney, WORK_TYPE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function DemoOverview() {
  const router = useRouter();
  const { setPersona, setRole } = useDemo();
  const { data, error, loading, reload } = useApi(() => api.listPersonas(), []);

  const open = (id: string, role: "borrower" | "lender") => {
    setPersona(id);
    setRole(role);
    router.push(role === "lender" ? `/lender/applicants/${id}` : "/borrower/profile");
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/lender">Lender dashboard</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 pb-16">
        <div className="mb-8 max-w-3xl">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Seven self-employed people. One engine.</h1>
          <p className="mt-2 text-lg text-muted-foreground">Every number below is computed live from 4–24 months of synthetic transactions and work activity — nothing is hard-coded.</p>
        </div>

        {error && <ErrorState error={error} onRetry={reload} />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {loading && !data && Array.from({ length: 7 }, (_, i) => <CardSkeleton key={i} lines={8} />)}
          {data?.map(({ borrower, report, story, expected }) => {
            const flagged = report.fraudFlags.length > 0;
            return (
              <Card key={borrower.id} className={cn("flex flex-col p-5", flagged && "border-risk/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold">{borrower.name.split(" ")[0]}</p>
                    <p className="text-sm text-muted-foreground">{WORK_TYPE_LABEL[borrower.workType]} · {borrower.tagline}</p>
                  </div>
                  <BandBadge band={report.band} />
                </div>
                <div className="my-4">
                  <ScoreGauge score={report.score} band={report.band} size="sm" />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Verified income</dt>
                    <dd className="tabular text-lg font-semibold">{formatMoney(report.verifiedMonthlyIncome)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Max payment</dt>
                    <dd className="tabular text-lg font-semibold">{formatMoney(report.recommendedMaxPayment)}</dd>
                  </div>
                </dl>
                <div className="mt-3 space-y-2 text-sm">
                  {report.workCheck.status !== "not_supported" && (
                    <div className="space-y-1">
                      <WorkStatusBadge status={report.workCheck.status} points={report.workCheck.points} />
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Radar className="size-3.5 shrink-0 text-brand" /> {report.workCheck.sourcesUsed.join(" + ") || "No work app"} · without work data {report.scoreWithoutActivity}
                        {bandFor(report.scoreWithoutActivity) !== report.band && <> ({bandFor(report.scoreWithoutActivity)})</>}
                      </p>
                    </div>
                  )}
                  {report.bandCapped && (
                    <p className="flex items-center gap-1.5 text-risk">
                      <ShieldAlert className="size-4 shrink-0" /> Capped from {report.uncappedScore} to {report.score}
                    </p>
                  )}
                  {flagged ? (
                    <ul className="space-y-1">
                      {report.fraudFlags.map((f) => (
                        <li key={f.type} className="flex items-center gap-1.5 text-risk">
                          <ShieldAlert className="size-3.5 shrink-0" /> {f.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="size-4 text-positive" /> No fraud flags
                    </p>
                  )}
                  {report.features.seasonal && <p className="text-muted-foreground">Seasonal pattern detected — income averaged over 12 months.</p>}
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{story}</p>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">Expected: {expected}</span>
                  <DecisionBadge decision={report.decision} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => open(borrower.id, "borrower")}>
                    <User /> Borrower
                  </Button>
                  <Button size="sm" onClick={() => open(borrower.id, "lender")}>
                    <Briefcase /> Lender
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
