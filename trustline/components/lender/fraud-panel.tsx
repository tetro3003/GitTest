"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import { SeverityBadge } from "@/components/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import type { EarlyWarning, FraudFlag, Invoice, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FraudPanel({ flags, warnings, transactions, invoices }: { flags: FraudFlag[]; warnings: EarlyWarning[]; transactions: Transaction[]; invoices: Invoice[] }) {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const invById = new Map(invoices.map((i) => [i.id, i]));
  return (
    <Card className="print-break">
      <CardHeader>
        <CardTitle>Fraud & risk checks</CardTitle>
        <CardDescription>Five integrity checks run on every report. High-severity flags cap the band at D.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!flags.length && (
          <p className="flex items-center gap-2 rounded-lg bg-positive-soft p-3 text-sm">
            <ShieldCheck className="size-4 text-positive" /> All checks passed: no circular transfers, spikes, activity mismatch, unmatched invoices or name mismatch.
          </p>
        )}
        {flags.map((f) => (
          <FlagItem key={f.type} flag={f} txs={f.transactionIds.map((id) => byId.get(id)).filter((t): t is Transaction => !!t)} invs={(f.invoiceIds ?? []).map((id) => invById.get(id)).filter((i): i is Invoice => !!i)} />
        ))}
        {warnings.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Early warnings (do not affect score)</p>
            {warnings.map((w) => (
              <p key={w.type} className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" /> {w.message}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlagItem({ flag, txs, invs }: { flag: FraudFlag; txs: Transaction[]; invs: Invoice[] }) {
  const [open, setOpen] = useState(flag.severity === "high");
  const count = txs.length + invs.length;
  return (
    <div className={cn("rounded-xl border p-4", flag.severity === "high" ? "border-risk/40 bg-risk-soft/50" : "border-warning/40 bg-warning-soft/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={flag.severity} />
        <p className="font-semibold">{flag.title}</p>
      </div>
      <p className="mt-1.5 text-sm">{flag.explanation}</p>
      {count > 0 && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={open}>
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Hide" : "Show"} {count} {txs.length ? "transaction" : "invoice"}
            {count > 1 ? "s" : ""}
          </button>
          {open && (
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border bg-card">
              <table className="w-full text-xs">
                <tbody className="tabular">
                  {txs.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                      <td className="px-3 py-1.5">{t.counterparty}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{t.direction === "in" ? "Received" : "Sent"}</td>
                      <td className={cn("px-3 py-1.5 text-right font-medium", t.direction === "in" ? "text-positive" : "")}>
                        {t.direction === "in" ? "+" : "−"}
                        {formatMoney(t.amount)}
                      </td>
                    </tr>
                  ))}
                  {invs.map((i) => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatDate(i.date)}</td>
                      <td className="px-3 py-1.5">Invoice to {i.client}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">No payment found</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatMoney(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
