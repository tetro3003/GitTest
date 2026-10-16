"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { BandBadge, DecisionBadge } from "@/components/badges";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatMoney, WORK_TYPE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { ApplicantQuery, ApplicationStatus, Band, WorkType } from "@/lib/types";
import { cn } from "@/lib/utils";

const BANDS: Band[] = ["A", "B", "C", "D", "E"];
const STATUS_LABEL: Record<ApplicationStatus, string> = { new: "New", in_review: "In review", approved: "Approved", declined: "Declined", active_loan: "Active loan" };

type SortKey = NonNullable<ApplicantQuery["sortBy"]>;

export default function Applicants() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [bands, setBands] = useState<Band[]>([]);
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [sortBy, setSortBy] = useState<SortKey>("appliedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const query = useMemo<ApplicantQuery>(() => ({ search, bands, workTypes: workType ? [workType] : [], sortBy, sortDir }), [search, bands, workType, sortBy, sortDir]);
  const { data, error, loading, reload } = useApi(() => api.getApplicants(query), [JSON.stringify(query)]);

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TH className={className} aria-sort={sortBy === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
        {children}
        {sortBy === k && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </TH>
  );

  const stats = data && {
    total: data.length,
    flagged: data.filter((d) => d.fraudFlagCount > 0).length,
    approve: data.filter((d) => d.decision === "approve").length,
    avgIncome: data.reduce((a, d) => a + d.verifiedMonthlyIncome, 0) / Math.max(1, data.length),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Applicants</h1>
          <p className="text-muted-foreground">Self-employed applicants who shared a {""}verified income profile with you.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Applicants", stats ? String(stats.total) : null],
          ["Suggested approve", stats ? String(stats.approve) : null],
          ["With fraud flags", stats ? String(stats.flagged) : null],
          ["Avg verified income", stats ? formatMoney(stats.avgIncome) : null],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            {v === null ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="tabular mt-1 font-display text-2xl font-semibold">{v}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or city" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search applicants" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Filter by band">
              {BANDS.map((b) => {
                const on = bands.includes(b);
                return (
                  <button
                    key={b}
                    aria-pressed={on}
                    onClick={() => setBands((cur) => (on ? cur.filter((x) => x !== b) : [...cur, b]))}
                    className={cn("size-9 rounded-lg border text-sm font-semibold", on ? "border-brand bg-brand-soft text-brand-strong" : "text-muted-foreground hover:bg-muted")}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            <NativeSelect value={workType} onChange={(e) => setWorkType(e.target.value as WorkType | "")} aria-label="Filter by work type">
              <option value="">All work types</option>
              {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((w) => (
                <option key={w} value={w}>
                  {WORK_TYPE_LABEL[w]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <SortHead k="name">Applicant</SortHead>
                <TH>Work type</TH>
                <SortHead k="score" className="text-right">Score</SortHead>
                <TH>Band</TH>
                <SortHead k="income" className="text-right">Verified income</SortHead>
                <TH className="text-right">Max payment</TH>
                <TH>Fraud</TH>
                <TH>Suggestion</TH>
                <TH>Status</TH>
                <SortHead k="appliedAt">Applied</SortHead>
                <TH className="w-8">
                  <span className="sr-only">Open</span>
                </TH>
              </TR>
            </THead>
            <TBody className={cn(loading && data && "opacity-60 transition-opacity")}>
              {loading && !data &&
                Array.from({ length: 6 }, (_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 11 }, (_, j) => (
                      <TD key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TD>
                    ))}
                  </TR>
                ))}
              {data?.map((a) => (
                <TR key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/lender/applicants/${a.id}`)}>
                  <TD>
                    <Link href={`/lender/applicants/${a.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {a.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.city}</p>
                  </TD>
                  <TD className="text-muted-foreground">{WORK_TYPE_LABEL[a.workType]}</TD>
                  <TD className="tabular text-right font-semibold">{a.score}</TD>
                  <TD>
                    <BandBadge band={a.band} />
                  </TD>
                  <TD className="tabular text-right">{formatMoney(a.verifiedMonthlyIncome)}</TD>
                  <TD className="tabular text-right text-muted-foreground">{formatMoney(a.recommendedMaxPayment)}</TD>
                  <TD>
                    {a.fraudFlagCount > 0 ? (
                      <Badge variant={a.highestSeverity === "high" ? "risk" : "warning"}>
                        <ShieldAlert /> {a.fraudFlagCount} flag{a.fraudFlagCount > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="size-3.5 text-positive" /> Clear
                      </span>
                    )}
                  </TD>
                  <TD>
                    <DecisionBadge decision={a.decision} />
                  </TD>
                  <TD className="text-muted-foreground">{STATUS_LABEL[a.status]}</TD>
                  <TD className="tabular whitespace-nowrap text-muted-foreground">{formatDate(a.appliedAt)}</TD>
                  <TD>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && !data.length && (
          <div className="p-4">
            <EmptyState title="No applicants match" description="Try clearing the search or band filters." />
          </div>
        )}
      </Card>
    </div>
  );
}
