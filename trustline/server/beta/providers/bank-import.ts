import { toUsd } from "@/lib/beta/fx";
import type { NewPayment } from "../store";
import { ProviderError } from "./figma";

/**
 * TBC Bank statement upload. Open banking is used for verification only
 * (who owns the account), so transactions come from the statement the
 * freelancer uploads each month (CSV, or the bank's open-banking JSON).
 * Statement payments are labelled as uploaded, not verified at source.
 */

export interface BankImport {
  holderName: string | null;
  payments: NewPayment[];
  rows: number;
}

const BANK = "TBC Bank statement";

interface BgTx {
  transactionId?: string;
  entryReference?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: { amount: string | number; currency: string };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  creditDebitIndicator?: string;
}

function credit(i: number, file: string, t: { id?: string; date: string; amount: number; currency: string; payer: string | null; text: string | null }): NewPayment | null {
  if (!(t.amount > 0)) return null;
  const usd = toUsd(t.amount, t.currency);
  const at = new Date(t.date);
  if (usd == null || Number.isNaN(at.getTime())) return null;
  return {
    extId: `bank:${t.id ?? `${file}:${i}`}`,
    at: at.toISOString(),
    source: "bank",
    amountUsd: usd,
    asset: t.currency.toUpperCase(),
    chain: BANK,
    payer: (t.payer || t.text || "Unknown sender").slice(0, 120),
    payerLabel: null,
    status: "income",
    note: "Uploaded statement",
    proof: `${BANK} · ${file}${t.id ? ` · ${t.id}` : ` · row ${i + 1}`}`,
  };
}

function fromJson(data: unknown, file: string): BankImport {
  const d = data as { account?: { ownerName?: string }; transactions?: { booked?: BgTx[] } | BgTx[] };
  const list: BgTx[] = Array.isArray(data) ? (data as BgTx[]) : Array.isArray(d.transactions) ? d.transactions : (d.transactions?.booked ?? []);
  const payments = list
    .map((t, i) => {
      const raw = Number(t.transactionAmount?.amount ?? NaN);
      const amount = t.creditDebitIndicator?.toUpperCase() === "DBIT" ? -Math.abs(raw) : raw;
      return credit(i, file, { id: t.transactionId ?? t.entryReference, date: t.bookingDate ?? t.valueDate ?? "", amount, currency: t.transactionAmount?.currency ?? "GEL", payer: t.debtorName ?? null, text: t.remittanceInformationUnstructured ?? null });
    })
    .filter((p): p is NewPayment => !!p);
  return { holderName: d.account?.ownerName ?? null, payments, rows: list.length };
}

function splitCsv(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const col = (headers: string[], ...names: RegExp[]) => headers.findIndex((h) => names.some((n) => n.test(h)));

function fromCsv(text: string, file: string): BankImport {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new ProviderError("The file has no transactions");
  const sep = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const headers = splitCsv(lines[0], sep).map((h) => h.toLowerCase());
  const iDate = col(headers, /date/, /თარიღ/);
  const iAmount = col(headers, /^amount$/, /amount/, /თანხა/);
  const iIn = col(headers, /credit|incoming|paid in|შემოსავ/);
  const iCur = col(headers, /currency|ccy|ვალუტ/);
  const iPayer = col(headers, /debtor|payer|sender|counterparty|from|partner|name/);
  const iText = col(headers, /description|details|remittance|purpose|დანიშნულ/);
  const iId = col(headers, /^id$|transaction ?id|reference/);
  if (iDate < 0 || (iAmount < 0 && iIn < 0)) throw new ProviderError("Couldn't find date and amount columns in the CSV");
  const num = (s: string | undefined) => Number((s ?? "").replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  const payments: NewPayment[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = splitCsv(line, sep);
    const amount = iIn >= 0 && c[iIn] ? num(c[iIn]) : num(c[iAmount]);
    const p = credit(i, file, { id: iId >= 0 ? c[iId] : undefined, date: c[iDate], amount, currency: iCur >= 0 && c[iCur] ? c[iCur] : "GEL", payer: iPayer >= 0 ? c[iPayer] : null, text: iText >= 0 ? c[iText] : null });
    if (p) payments.push(p);
  });
  return { holderName: null, payments, rows: lines.length - 1 };
}

export function parseBankFile(file: string, content: string): BankImport {
  const trimmed = content.trim();
  if (!trimmed) throw new ProviderError("The file is empty");
  if (/^[[{]/.test(trimmed)) {
    try {
      return fromJson(JSON.parse(trimmed), file);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("The JSON file couldn't be read");
    }
  }
  return fromCsv(trimmed, file);
}
