import { KeyRound, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_NAME } from "@/lib/config";
import { ApiTryIt } from "@/components/lender/api-try-it";
import { buildScoringInput } from "@/lib/mock/dataset";
import { getPersona } from "@/lib/mock/personas";
import { computeScoreReport } from "@/lib/scoring";

export const metadata = { title: "Scoring API" };

/** Example payloads are produced by the real engine at build time, so docs never drift from behaviour. */
function exampleResponse() {
  const p = getPersona("giorgi");
  if (!p) return {};
  const r = computeScoreReport(buildScoringInput(p, p.spec.sources));
  return {
    reportId: "rpt_7Hc2xQ",
    borrowerId: r.borrowerId,
    score: r.score,
    band: r.band,
    decision: r.decision,
    verifiedMonthlyIncome: r.verifiedMonthlyIncome,
    recommendedMaxPayment: r.recommendedMaxPayment,
    currency: "GEL",
    workCheck: { status: r.workCheck.status, points: r.workCheck.points, profession: r.workCheck.profession, sources: r.workCheck.sourcesUsed, explainedIncome: r.workCheck.explainedIncome, evidence: r.workCheck.evidence.slice(0, 3) },
    reasons: r.reasons.filter((x) => x.impact !== 0).slice(0, 4).map(({ id, label, impact, detail }) => ({ id, label, impact, detail })),
    fraudFlags: r.fraudFlags,
    earlyWarnings: r.earlyWarnings,
    monthlyIncome: r.monthlyIncome.slice(-2).map(({ month, verified, gross }) => ({ month, verified, gross })),
    consent: { shareCode: "TL-8F3K-4821", scope: ["score", "income", "reasons", "fraud_checks"], expiresAt: "2026-10-31T09:00:00Z" },
    generatedAt: r.generatedAt,
  };
}

const REQUEST = `POST /api/v1/reports
Authorization: Bearer tl_demo_citybank_key
Content-Type: application/json

{ "shareCode": "TL-XXXX-1234" }`;

const ENDPOINTS: [string, string, string][] = [
  ["POST", "/api/v1/reports", "Lender: exchange a borrower's share code for a scored report"],
  ["GET", "/api/v1/lender/applicants", "Lender: applicants who shared with you (search, band, workType, sortBy)"],
  ["GET", "/api/v1/lender/applicants/{id}", "Lender: full report, limited to the borrower's consent scope"],
  ["GET", "/api/v1/lender/monitoring", "Lender: early warnings and fraud alerts"],
  ["GET", "/api/v1/lender/audit", "Lender: everything your key accessed"],
  ["POST", "/api/v1/borrowers/{id}/sources/{sid}/import", "Borrower: upload any app's export (CSV/JSON)"],
  ["POST", "/api/v1/ingest/{key}", "Webhook: work events from Zapier, Make, sensors or the desktop tracker"],
  ["POST", "/api/v1/borrowers/{id}/sources/{sid}/connect", "Borrower: connect (GitHub username / Figma token for real data)"],
  ["POST", "/api/v1/borrowers/{id}/shares", "Borrower: share with a lender (scope + days)"],
  ["POST", "/api/v1/borrowers/{id}/shares/{shareId}/revoke", "Borrower: revoke a lender's access immediately"],
  ["GET", "/api/v1/health", "Health check"],
];

const WEBHOOK = `POST /api/v1/ingest/tl_ing_…
Content-Type: application/json

{ "events": [
  { "at": "2026-09-30T14:00", "minutes": 60, "kind": "appointment",
    "client": "Client A", "amount": 45, "item": "Haircut" }
] }`;

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre aria-label={label} className="overflow-x-auto rounded-xl bg-[oklch(0.2_0.02_230)] p-4 font-mono text-xs leading-relaxed text-[oklch(0.92_0.02_200)]">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocs() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Badge variant="muted" className="mb-2">v1 · preview</Badge>
        <h1 className="font-display text-2xl font-bold tracking-tight">{PRODUCT_NAME} Scoring API</h1>
        <p className="max-w-2xl text-muted-foreground">
          Plug verified self-employed income into your existing loan origination system. The borrower gives you a share code; you exchange it for a scored report with reasons and fraud checks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {ENDPOINTS.map(([m, path, desc]) => (
              <li key={path + m} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className={`w-14 rounded-md px-2 py-0.5 text-center font-mono text-xs font-semibold ${m === "GET" ? "bg-brand-soft text-brand-strong" : "bg-warning-soft text-warning-strong"}`}>{m}</span>
                <code className="font-mono text-sm">{path}</code>
                <span className="text-muted-foreground">{desc}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ApiTryIt />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <CardDescription>Exchange a share code for a report.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code label="Example request">{REQUEST}</Code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Response · 200 OK</CardTitle>
            <CardDescription>Generated by the scoring engine for the “Giorgi” demo persona.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-auto rounded-xl">
              <Code label="Example response">{JSON.stringify(exampleResponse(), null, 2)}</Code>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-brand" /> Authentication & consent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Each lender has its own API key (stored hashed). A lender only sees applicants with an active share to it; scope and expiry are enforced on the server, and a revoked share returns <code className="font-mono">403</code> immediately. Every access is written to the audit log, which the borrower can see.</p>
            <p>Scores are reproducible: the same consented data always yields the same report, with every reason and point impact included for audit.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="size-4 text-brand" /> Work-event webhook (any app)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Code label="Example webhook payload">{WEBHOOK}</Code>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
