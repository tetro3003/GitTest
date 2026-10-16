import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPct } from "@/lib/format";
import type { ScoreReport } from "@/lib/types";

/** Raw engine features, for analysts who want to see the inputs. */
export function FeaturesCard({ report }: { report: ScoreReport }) {
  const f = report.features;
  const rows: [string, string][] = [
    ["Avg income 3m / 6m / 12m", `${formatMoney(f.avgIncome3m)} / ${formatMoney(f.avgIncome6m)} / ${formatMoney(f.avgIncome12m)}`],
    ["Median income 6m (weighted)", formatMoney(f.medianIncome6m)],
    ["Income CV (around trend)", f.incomeCV.toFixed(2)],
    ["Trend", `${f.trend} (${(f.trendSlope * 100).toFixed(1)}%/mo)`],
    ["Seasonal pattern", f.seasonal ? "Yes — repeats yearly" : "No"],
    ["Zero-income months (12m)", String(f.zeroIncomeMonths)],
    ["Income payers ≥5% / top share", `${f.incomeSourceCount} / ${formatPct(f.topSourceShare)}`],
    ["Essential spend / debt", `${formatMoney(f.essentialSpend)} / ${formatMoney(f.existingDebtPayments)}`],
    ["Free cash flow", `${formatMoney(f.freeCashFlow)} (${formatPct(f.freeCashFlowRatio)})`],
    ["Avg monthly low balance", formatMoney(f.minBalanceAvg)],
    ["Near-zero balance days", String(f.nearZeroBalanceCount)],
    ["On-time bills", f.onTimeBillRate === null ? "—" : formatPct(f.onTimeBillRate)],
    ["Loan repayments on time", f.loanRepaymentOnTime === null ? "—" : formatPct(f.loanRepaymentOnTime)],
    ["Gambling share", formatPct(f.gamblingShare, 1)],
    ["Active weeks (52w)", f.hasActivityData ? `${f.activeWeeksLast52} (${formatPct(f.activityConsistency)})` : "Not shared"],
    ["Activity trend / 4w change", f.hasActivityData ? `${f.activityTrend} / ${formatPct(f.activityChange4w)}` : "—"],
    ["Avg rating", f.avgRating?.toFixed(2) ?? "—"],
    ["Income history", `${f.tenureMonths} months`],
  ];
  return (
    <Card className="print-break">
      <CardHeader>
        <CardTitle>Model inputs</CardTitle>
        <CardDescription>Features extracted from shared data. Last 2 months are down-weighted.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
