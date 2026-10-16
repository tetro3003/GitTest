"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { BandBadge, DecisionBadge, SeverityBadge } from "@/components/badges";
import { LogoMark } from "@/components/logo";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { PRODUCT_NAME, SCORING_CONFIG } from "@/lib/config";
import { formatDate, formatMoney, formatMonth, signed, WORK_TYPE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { SOURCE_TYPE_LABEL } from "@/lib/mock/sources";
import { cn } from "@/lib/utils";

/** Clean, printable one-pager. "Download" = browser print to PDF. */
export default function PrintableReport() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi(() => api.getApplicant(id), [id]);

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (error) return <div className="mx-auto max-w-3xl p-8"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !data)
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  const { borrower, report } = data;
  const maxIncome = Math.max(...report.monthlyIncome.map((m) => m.verified), 1);

  return (
    <div className="mx-auto max-w-3xl bg-card p-8 text-sm print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <Button onClick={() => window.print()}>
          <Printer /> Print / save as PDF
        </Button>
      </div>

      <header className="flex items-start justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9" />
          <div>
            <p className="font-display text-lg font-semibold">{PRODUCT_NAME} Income & Risk Report</p>
            <p className="text-xs text-muted-foreground">Generated {formatDate(report.generatedAt)} · Report ID {report.borrowerId.toUpperCase()}-{report.generatedAt.slice(0, 10).replace(/-/g, "")}</p>
          </div>
        </div>
        <DecisionBadge decision={report.decision} />
      </header>

      <section className="grid grid-cols-2 gap-6 border-b py-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Applicant</p>
          <p className="mt-1 text-lg font-semibold">{borrower.name}</p>
          <p className="text-muted-foreground">{WORK_TYPE_LABEL[borrower.workType]} · {borrower.city} · KYC {borrower.kycStatus}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sources: {borrower.connectedSources.filter((s) => s.status === "connected").map((s) => `${s.provider} (${SOURCE_TYPE_LABEL[s.type]})`).join(", ")}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Score</dt>
            <dd className="tabular text-2xl font-semibold">
              {report.score} <span className="text-xs font-normal text-muted-foreground">/ {SCORING_CONFIG.maxScore}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Band</dt>
            <dd className="mt-1"><BandBadge band={report.band} showLabel /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Verified monthly income</dt>
            <dd className="tabular text-lg font-semibold">{formatMoney(report.verifiedMonthlyIncome)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Max monthly payment</dt>
            <dd className="tabular text-lg font-semibold">{formatMoney(report.recommendedMaxPayment)}</dd>
          </div>
        </dl>
      </section>

      <section className="print-break border-b py-5">
        <h2 className="mb-3 font-semibold">Verified income, last 12 months</h2>
        <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Monthly verified income bars">
          {report.monthlyIncome.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-[var(--chart-1)] print:bg-gray-700" style={{ height: `${(m.verified / maxIncome) * 90}px` }} />
              <span className="text-[10px] text-muted-foreground">{formatMonth(m.month)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="print-break border-b py-5">
        <h2 className="mb-2 font-semibold">Score reasons (base {report.baseScore})</h2>
        <table className="w-full">
          <tbody className="tabular">
            {report.reasons.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3 font-medium">{r.label}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{r.detail}</td>
                <td className={cn("py-1.5 text-right font-semibold", r.impact > 0 ? "text-positive" : r.impact < 0 ? "text-risk" : "")}>{signed(r.impact)}</td>
              </tr>
            ))}
            {report.bandCapped && (
              <tr>
                <td className="py-1.5 pr-3 font-medium">Fraud cap</td>
                <td className="py-1.5 pr-3 text-muted-foreground">High-severity flag caps band at D</td>
                <td className="py-1.5 text-right font-semibold text-risk">{signed(report.score - report.uncappedScore)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="print-break py-5">
        <h2 className="mb-2 font-semibold">Fraud & risk checks</h2>
        {report.fraudFlags.length === 0 ? (
          <p className="text-muted-foreground">All five checks passed.</p>
        ) : (
          <ul className="space-y-2">
            {report.fraudFlags.map((f) => (
              <li key={f.type}>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} /> <span className="font-medium">{f.title}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{f.explanation}</p>
              </li>
            ))}
          </ul>
        )}
        {report.earlyWarnings.map((w) => (
          <p key={w.type} className="mt-2 text-muted-foreground">⚠ {w.message}</p>
        ))}
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Generated from data the applicant consented to share. Verified income excludes self-transfers, suspected circular transfers and accounts not held by the applicant; the last two months are down-weighted. Synthetic demo data.
      </footer>
    </div>
  );
}
