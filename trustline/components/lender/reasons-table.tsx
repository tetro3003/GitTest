import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signed } from "@/lib/format";
import type { ScoreReport } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Point-based reasons for lenders — every row comes straight from the engine. */
export function ReasonsTable({ report }: { report: ScoreReport }) {
  const rows = [...report.reasons].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const max = Math.max(...rows.map((r) => Math.abs(r.impact)), 1);
  return (
    <Card className="print-break">
      <CardHeader>
        <CardTitle>Reasons</CardTitle>
        <CardDescription>All scorecard factors, sorted by impact. Base {report.baseScore}.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[1fr_120px_56px]">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground" title={r.detail}>{r.detail}</p>
              </div>
              <div className="hidden h-2 rounded-full bg-muted sm:block" aria-hidden>
                <div
                  className={cn("h-2 rounded-full", r.impact > 0 ? "bg-positive" : r.impact < 0 ? "bg-risk" : "bg-muted-foreground/30")}
                  style={{ width: `${(Math.abs(r.impact) / max) * 100}%` }}
                />
              </div>
              <span className={cn("tabular text-right text-sm font-semibold", r.impact > 0 ? "text-positive" : r.impact < 0 ? "text-risk" : "text-muted-foreground")}>
                {signed(r.impact)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
