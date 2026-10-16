import { AlertTriangle, CheckCircle2, CircleSlash, HelpCircle, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WORK_CHECK_POINTS } from "@/lib/checker/profiles";
import { formatMoney, signed } from "@/lib/format";
import type { ActivityRecord, WorkCheckResult, WorkCheckStatus, WorkEvidenceLine } from "@/lib/types";
import { cn } from "@/lib/utils";

export const WORK_STATUS_META: Record<WorkCheckStatus, { label: string; tone: "positive" | "default" | "warning" | "risk" | "muted"; icon: typeof CheckCircle2 }> = {
  strong: { label: "Strong evidence", tone: "positive", icon: CheckCircle2 },
  moderate: { label: "Moderate evidence", tone: "default", icon: CheckCircle2 },
  weak: { label: "Weak evidence", tone: "warning", icon: AlertTriangle },
  mismatch: { label: "Doesn't match income", tone: "risk", icon: ShieldAlert },
  not_shared: { label: "Not shared", tone: "warning", icon: CircleSlash },
  not_supported: { label: "Not available yet", tone: "muted", icon: HelpCircle },
};

export function WorkStatusBadge({ status, points }: { status: WorkCheckStatus; points?: number }) {
  const m = WORK_STATUS_META[status];
  return (
    <Badge variant={m.tone}>
      <m.icon /> {m.label}
      {points !== undefined && status !== "not_supported" && <span className="tabular font-semibold">· {signed(points)}</span>}
    </Badge>
  );
}

/** Range bar: the income the shared work can explain, with the verified income marked on it. */
export function IncomeCoverageBar({ result }: { result: WorkCheckResult }) {
  const r = result.explainedIncome;
  if (!r) return null;
  const max = Math.max(r.high * 1.6, result.income * 1.15, 1);
  const pos = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  // Earning less than the work could explain is fine; only income above the range is a concern.
  const inside = result.income <= r.high * 1.15;
  return (
    <figure
      className="space-y-2"
      role="img"
      aria-label={`Work can explain ${formatMoney(r.low)} to ${formatMoney(r.high)} a month; verified income is ${formatMoney(result.income)}`}
    >
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-3 h-3 rounded-full bg-muted" />
        <div className="absolute top-3 h-3 rounded-full bg-positive/70" style={{ left: pos(r.low), width: `calc(${pos(r.high)} - ${pos(r.low)})` }} />
        <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(result.income) }}>
          <span className={cn("h-9 w-1 rounded-full", inside ? "bg-foreground" : "bg-risk")} />
        </div>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block size-2.5 rounded-sm bg-positive/70 align-middle" />
          Work explains {formatMoney(r.low)}–{formatMoney(r.high)}/mo
        </span>
        <span className={cn("font-medium", inside ? "text-foreground" : "text-risk")}>Verified income {formatMoney(result.income)}</span>
      </figcaption>
    </figure>
  );
}

export function EvidenceList({ lines }: { lines: WorkEvidenceLine[] }) {
  return (
    <ul className="divide-y">
      {lines.map((e) => (
        <li key={e.label} className="flex items-start gap-3 py-2.5 text-sm">
          {e.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-label="Passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-risk" aria-label="Not passed" />}
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{e.label}</span>
            <span className="block text-xs text-muted-foreground">Target: {e.target}</span>
          </span>
          <span className="tabular text-right font-semibold">{e.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function PointsLegend() {
  const rows: [WorkCheckStatus, string][] = [
    ["strong", "Regular work that clearly backs up the income"],
    ["moderate", "Mostly backs it up; some checks didn't pass"],
    ["weak", "Patchy or very little work data"],
    ["not_shared", "No work app connected"],
    ["mismatch", "Work can't explain the income — lender reviews it"],
  ];
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(([s, d]) => (
        <li key={s} className="grid grid-cols-[2.5rem_1fr] gap-x-3 sm:grid-cols-[2.5rem_11rem_1fr]">
          <span className={cn("tabular text-right font-semibold", WORK_CHECK_POINTS[s] > 0 ? "text-positive" : "text-risk")}>{signed(WORK_CHECK_POINTS[s])}</span>
          <span className="font-medium">{WORK_STATUS_META[s].label}</span>
          <span className="col-start-2 text-muted-foreground sm:col-start-3">{d}</span>
        </li>
      ))}
    </ul>
  );
}

/** Salon sensors: totals over the last 52 weeks. */
export function SensorTotals({ activity, sourceId }: { activity: ActivityRecord[]; sourceId: string }) {
  const rows = activity.filter((a) => a.sourceId === sourceId).slice(-52);
  if (!rows.length) return null;
  const sum = (k: string) => rows.reduce((a, r) => a + (r.signals[k] ?? 0), 0);
  const tiles: [string, number][] = [
    ["Visitors", sum("visitors")],
    ["Hair services", sum("hair")],
    ["Nail services", sum("nails")],
    ["Other services", sum("otherServices")],
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Last 12 months from salon sensors</p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="tabular font-display text-xl font-semibold">{v.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Human-readable stats for a shared item, e.g. "42 versions · 6 client comments". */
export function itemStatsText(stats: Record<string, number>): string {
  const labels: Record<string, string> = {
    versions: "versions",
    sessions: "sessions",
    clientComments: "client comments",
    commits: "commits",
    prsMerged: "PRs merged",
    issuesResolved: "issues resolved",
    lessons: "lessons",
    students: "student visits",
    recordedMinutes: "min recorded",
    speechMinutes: "min of speech",
    hours: "h",
  };
  return Object.entries(stats)
    .filter(([k, v]) => labels[k] && v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${Math.round(v).toLocaleString("en-US")} ${labels[k]}`)
    .join(" · ");
}
