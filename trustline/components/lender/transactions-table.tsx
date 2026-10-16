"use client";

import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import type { DataSource, Transaction, TransactionCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_LABEL: Record<TransactionCategory, string> = {
  platform_payout: "Platform payout",
  client_payment: "Client payment",
  transfer_self: "Own transfer",
  transfer_p2p: "P2P transfer",
  rent: "Rent",
  utilities: "Utilities",
  groceries: "Groceries",
  fuel: "Fuel",
  loan_repayment: "Loan repayment",
  gambling: "Gambling",
  other: "Other spending",
};

const PAGE = 25;

export function TransactionsTable({ transactions, sources, flaggedIds }: { transactions: Transaction[]; sources: DataSource[]; flaggedIds: Set<string> }) {
  const [category, setCategory] = useState<TransactionCategory | "">("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [q, setQ] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [page, setPage] = useState(0);
  const provider = new Map(sources.map((s) => [s.id, s.provider]));

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return [...transactions]
      .reverse()
      .filter((t) => (!category || t.category === category) && (!direction || t.direction === direction) && (!s || t.counterparty.toLowerCase().includes(s)) && (!onlyFlagged || flaggedIds.has(t.id)));
  }, [transactions, category, direction, q, onlyFlagged, flaggedIds]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>Categorized transactions</CardTitle>
        <CardDescription>
          {transactions.length.toLocaleString()} transactions from connected accounts. {flaggedIds.size > 0 && `${flaggedIds.size} involved in fraud flags.`}
        </CardDescription>
      </CardHeader>
      <div className="flex flex-wrap gap-2 border-y px-5 py-3">
        <Input placeholder="Search counterparty" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="h-9 w-48" aria-label="Search counterparty" />
        <NativeSelect className="h-9" value={category} onChange={(e) => { setCategory(e.target.value as TransactionCategory | ""); setPage(0); }} aria-label="Category">
          <option value="">All categories</option>
          {(Object.keys(CATEGORY_LABEL) as TransactionCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </NativeSelect>
        <NativeSelect className="h-9" value={direction} onChange={(e) => { setDirection(e.target.value as "" | "in" | "out"); setPage(0); }} aria-label="Direction">
          <option value="">In & out</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </NativeSelect>
        {flaggedIds.size > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--risk)]" checked={onlyFlagged} onChange={(e) => { setOnlyFlagged(e.target.checked); setPage(0); }} />
            Flagged only
          </label>
        )}
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Date</TH>
            <TH>Counterparty</TH>
            <TH>Category</TH>
            <TH>Account</TH>
            <TH className="text-right">Amount</TH>
            <TH className="text-right">Balance</TH>
          </TR>
        </THead>
        <TBody className="tabular">
          {shown.map((t) => {
            const flagged = flaggedIds.has(t.id);
            return (
              <TR key={t.id} className={cn(flagged && "bg-risk-soft/60")}>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</TD>
                <TD>
                  <span className="flex items-center gap-1.5">
                    {flagged && <ShieldAlert className="size-3.5 text-risk" aria-label="Flagged" />}
                    {t.counterparty}
                  </span>
                </TD>
                <TD className="text-muted-foreground">{CATEGORY_LABEL[t.category]}</TD>
                <TD className="text-muted-foreground">{provider.get(t.sourceId) ?? t.sourceId}</TD>
                <TD className={cn("text-right font-medium", t.direction === "in" && "text-positive")}>
                  {t.direction === "in" ? "+" : "−"}
                  {formatMoney(t.amount)}
                </TD>
                <TD className={cn("text-right text-muted-foreground", t.balanceAfter < 20 && "text-risk")}>{formatMoney(t.balanceAfter)}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">No transactions match these filters.</p>}
      <div className="flex items-center justify-between px-5 py-3 text-sm text-muted-foreground">
        <span>
          {rows.length ? `${current * PAGE + 1}–${Math.min(rows.length, (current + 1) * PAGE)} of ${rows.length}` : "0 results"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>Next</Button>
        </div>
      </div>
    </Card>
  );
}
