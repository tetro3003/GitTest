import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ScoreReason } from "@/lib/types";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Plain-language reasons for borrowers (points shown small, words first). */
export function PlainReasons({ reasons, kind }: { reasons: ScoreReason[]; kind: "positive" | "negative" }) {
  const items = reasons
    .filter((r) => r.direction === kind)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 4);
  if (!items.length) return <p className="text-sm text-muted-foreground">{kind === "positive" ? "Nothing yet — connect more sources." : "Nothing is holding your score back."}</p>;
  const Icon = kind === "positive" ? ArrowUpRight : ArrowDownRight;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
          <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", kind === "positive" ? "bg-positive-soft text-positive" : "bg-risk-soft text-risk")}>
            <Icon className="size-4" />
          </span>
          <span className="flex-1 text-sm">{r.plain}</span>
          <span className={cn("tabular text-xs font-semibold", kind === "positive" ? "text-positive" : "text-risk")}>{signed(r.impact)}</span>
        </li>
      ))}
    </ul>
  );
}
