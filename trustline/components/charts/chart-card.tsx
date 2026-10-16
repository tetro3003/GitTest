"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Card wrapper for charts: title, description, accessible label and a table view toggle. */
export function ChartCard({
  title,
  description,
  table,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string;
  table?: ChartTable;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("print-break", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="no-print flex items-center gap-1">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={asTable ? "Show chart" : "Show data table"}
              aria-pressed={asTable}
            >
              {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            </button>
          )}
        </div>
      </CardHeader>
      <div className="px-3 pb-4 sm:px-5">
        {asTable && table ? (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    {r.map((v, j) => (
                      <td key={j} className="px-3 py-1.5">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/** Shared tooltip shell, styled with tokens. */
export function TooltipBox({ title, items }: { title: string; items: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{title}</p>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {it.color && <span className={cn("inline-block size-2.5 rounded-sm", it.dashed && "h-0.5 w-3 rounded-none")} style={{ backgroundColor: it.color }} />}
              {it.label}
            </span>
            <span className="tabular font-medium text-foreground">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean; dashed?: boolean }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.line ? (
            <svg width="16" height="8" aria-hidden>
              <line x1="0" y1="4" x2="16" y2="4" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "4 3" : undefined} />
            </svg>
          ) : (
            <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Colour follows the entity: known income labels get fixed slots, others take the next free slot in order. */
const FIXED: Record<string, number> = { "Direct clients": 2, "P2P transfers": 6 };
export function seriesColors(labels: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const order = [1, 3, 4, 5];
  let k = 0;
  for (const l of labels) out[l] = `var(--chart-${FIXED[l] ?? order[k++ % order.length]})`;
  return out;
}

export const axisProps = {
  stroke: "var(--muted-foreground)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
