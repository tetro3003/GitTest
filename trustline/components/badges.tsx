import { AlertTriangle, CheckCircle2, ShieldAlert, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BAND_META, DECISION_META, SEVERITY_TONE } from "@/lib/format";
import type { Band, Decision, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BandBadge({ band, className, showLabel = false }: { band: Band; className?: string; showLabel?: boolean }) {
  const meta = BAND_META[band];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold", className)}
      style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 18%, transparent)`, color: `color-mix(in oklch, ${meta.color} 75%, var(--foreground))` }}
      aria-label={`Band ${band}, ${meta.label}`}
    >
      {band}
      {showLabel && <span className="font-medium">{meta.label}</span>}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  const m = DECISION_META[decision];
  const Icon = decision === "approve" ? CheckCircle2 : decision === "decline" ? XCircle : Search;
  return (
    <Badge variant={m.tone}>
      <Icon /> {m.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = severity === "high" ? ShieldAlert : AlertTriangle;
  return (
    <Badge variant={SEVERITY_TONE[severity]} className="capitalize">
      <Icon /> {severity}
    </Badge>
  );
}
