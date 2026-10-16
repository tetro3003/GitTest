import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceList, IncomeCoverageBar, itemStatsText, SensorTotals, WorkStatusBadge } from "@/components/work-check";
import { CHANNEL_LABEL } from "@/lib/checker/profiles";
import type { ActivityRecord, DataSource, WorkCheckResult, WorkItem } from "@/lib/types";

/** Lender view of the profession-specific Work Checker. */
export function WorkCheckPanel({ result, items, activity, sources }: { result: WorkCheckResult; items: WorkItem[]; activity: ActivityRecord[]; sources: DataSource[] }) {
  const provider = new Map(sources.map((s) => [s.id, s.provider]));
  const shared = items.filter((i) => i.shared);
  const hidden = items.length - shared.length;
  const sensors = sources.find((s) => s.type === "salon_sensors" && s.status === "connected");
  return (
    <Card className="print-break">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Work Checker · {result.profession}</CardTitle>
          <CardDescription>Does the applicant&apos;s real work explain their income? {result.sourcesUsed.length ? `Sources: ${result.sourcesUsed.join(", ")}.` : ""}</CardDescription>
        </div>
        <WorkStatusBadge status={result.status} points={result.points} />
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">{result.summary}</p>
        <IncomeCoverageBar result={result} />
        <div className="grid gap-5 lg:grid-cols-2">
          {result.evidence.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Checks (last 12 weeks)</p>
              <EvidenceList lines={result.evidence} />
            </div>
          )}
          {items.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Shared work items{hidden > 0 ? ` · ${hidden} kept private by applicant` : ""}
              </p>
              <ul className="divide-y text-sm">
                {shared.map((i) => (
                  <li key={i.id} className="py-2">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider.get(i.sourceId)} · {itemStatsText(i.stats) || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {sensors && <SensorTotals activity={activity} sourceId={sensors.id} />}
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Where the work data comes from</p>
          <ul className="space-y-1 text-sm">
            {sources
              .filter((s) => s.status === "connected" && s.tier === 3 && s.type !== "invoice_upload")
              .map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{s.provider}</span>
                  <span className="text-muted-foreground">
                    {s.evidence ? `${CHANNEL_LABEL[s.evidence.channel]} · ${s.evidence.label} · ${s.evidence.events.toLocaleString("en-US")} records` : "Demo data (simulated)"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
