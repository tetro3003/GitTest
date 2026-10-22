"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PaymentFact } from "@/lib/beta/types";
import { cn } from "@/lib/utils";

/** Wallet addresses get shortened; people and company names don't. */
const isAddress = (s: string) => !/\s/.test(s) && s.length > 24;

const STATUS: Record<PaymentFact["status"], { label: string; variant: "positive" | "muted" | "warning" }> = {
  income: { label: "Income", variant: "positive" },
  own_transfer: { label: "Own money", variant: "muted" },
  unclear: { label: "Not counted", variant: "warning" },
  ignored: { label: "Spam", variant: "muted" },
  duplicate: { label: "Counted once", variant: "muted" },
  not_income: { label: "Not income", variant: "muted" },
};

export function PaymentsTable({ payments }: { payments: PaymentFact[] }) {
  if (!payments.length) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="font-display text-lg font-semibold">Payments we found</h2>
      <p className="text-sm text-muted-foreground">From every connected source, each with its proof. Hover a badge to see why it does or doesn&apos;t count.</p>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur text-left text-xs text-muted-foreground">
            <tr><th className="py-2 pr-3 font-medium">Date</th><th className="pr-3 font-medium">Amount (USD)</th><th className="pr-3 font-medium">From</th><th className="pr-3 font-medium">Counts?</th><th className="font-medium"><span className="sr-only">Proof</span></th></tr>
          </thead>
          <tbody className="divide-y">
            {payments.slice(0, 200).map((p) => (
              <tr key={p.proof + p.asset + p.at}>
                <td className="py-2 pr-3 tabular-nums">{p.at.slice(0, 10)}</td>
                <td className="pr-3 tabular-nums">
                  ${p.amountUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  <span className="block text-xs text-muted-foreground">{p.chain}{/^(USD|USDT|USDC)$/.test(p.asset) ? "" : ` · paid in ${p.asset}`}</span>
                </td>
                <td className={cn("max-w-44 truncate pr-3 text-xs", isAddress(p.payer) && "font-mono")} title={p.payer}>{p.payerLabel ?? (isAddress(p.payer) ? `${p.payer.slice(0, 6)}…${p.payer.slice(-4)}` : p.payer)}</td>
                <td className="pr-3"><Badge variant={STATUS[p.status].variant} title={p.note ?? undefined}>{STATUS[p.status].label}</Badge></td>
                <td>
                  {/^https?:/.test(p.proof) ? (
                    <a href={p.proof} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open on explorer"><ExternalLink className="size-4" /></a>
                  ) : (
                    <span title={p.proof} className="cursor-help text-muted-foreground"><ShieldCheck className="size-4" aria-label={p.proof} /></span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
