/** Tiny inline trend line (no axes). Decorative companion to a text label. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const down = last < first * 0.85;
  return (
    <svg width={w} height={h} className={className} role="img" aria-label={label}>
      <polyline points={pts} fill="none" stroke={down ? "var(--risk)" : "var(--chart-1)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
