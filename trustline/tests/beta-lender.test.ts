import { describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db";
import { createBetaHttp } from "@/server/beta/http";
import { createBetaService } from "@/server/beta/service";
import { createBetaStore } from "@/server/beta/store";
import { createVault } from "@/server/beta/vault";
import type { LenderReport } from "@/lib/beta/types";

function setup() {
  const service = createBetaService({ store: createBetaStore(openDatabase(":memory:")), vault: createVault(Buffer.alloc(32, 5)), now: () => new Date("2026-10-15T12:00:00Z") });
  const handle = createBetaHttp(service);
  const client = () => {
    let cookie = "";
    return async <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => {
      const res = await handle(new Request(`http://localhost:3000/api/beta/${path}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }), path.split("?")[0].split("/"));
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: res.status, body: (await res.json()) as T };
    };
  };
  return { service, client };
}

const CSV = ["date,amount,currency,counterparty", ...Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-05,${4000 + (i % 3) * 300}.00,GEL,${i % 2 ? "Bloom LLC" : "Kavea LLC"}`)].join("\n");

describe("lender review and human decision", () => {
  it("needs consent, shows the report with reasons, records human decisions and the audit trail", async () => {
    const { client } = setup();
    const nino = client();
    const bank = client();
    await nino("POST", "signup", { email: "nino@example.com", name: "Nino Beridze", password: "password123" });
    await nino("POST", "bank/import", { filename: "tbc.csv", content: CSV });
    expect((await bank("POST", "signup", { email: "officer@citybank.ge", name: "Ana Officer", password: "password123", role: "lender" })).status).toBe(400);
    const lender = await bank<{ user: { id: string; role: string; org: string } }>("POST", "signup", { email: "officer@citybank.ge", name: "Ana Officer", password: "password123", role: "lender", org: "City Bank" });
    expect(lender.body.user).toMatchObject({ role: "lender", org: "City Bank" });
    const ninoId = (await nino<{ user: { id: string } }>("GET", "me")).body.user.id;

    // No consent yet: the bank sees nothing.
    expect((await bank<unknown[]>("GET", "lender/applicants")).body).toEqual([]);
    expect((await bank("GET", `lender/applicants/${ninoId}`)).status).toBe(403);
    // A freelancer can't use lender endpoints.
    expect((await nino("GET", "lender/applicants")).status).toBe(403);

    const lenders = (await nino<{ id: string; org: string }[]>("GET", "lenders")).body;
    expect(lenders).toEqual([{ id: lender.body.user.id, org: "City Bank" }]);
    const shared = await nino<{ shareId: string }>("POST", "shares", { lenderId: lenders[0].id });
    expect(shared.status).toBe(201);

    const list = (await bank<{ applicantId: string; name: string; score: number | null }[]>("GET", "lender/applicants")).body;
    expect(list.map((a) => a.name)).toEqual(["Nino Beridze"]);

    const report = (await bank<LenderReport>("GET", `lender/applicants/${ninoId}`)).body;
    expect(report.score.ready).toBe(true);
    expect(report.explanation.by).toBe("rules");
    expect(report.explanation.text).toMatch(/verified \$[\d,]+ in a typical month/);
    expect(report.recommendation.why.length).toBeGreaterThan(0);
    expect(report.generatedMs).toBeGreaterThanOrEqual(0);
    expect(report.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["Shared report", "Opened report", "Rule-based explanation"]));

    // Human decision: decline needs a reason; approve needs an amount.
    expect((await bank("POST", `lender/applicants/${ninoId}/decision`, { decision: "decline" })).status).toBe(400);
    expect((await bank("POST", `lender/applicants/${ninoId}/decision`, { decision: "approve" })).status).toBe(400);
    expect((await bank("POST", `lender/applicants/${ninoId}/decision`, { decision: "request_info", note: "Please connect a work tool" })).status).toBe(201);
    expect((await bank("POST", `lender/applicants/${ninoId}/decision`, { decision: "approve", amountUsd: 400, note: "Steady bank income" })).status).toBe(201);

    const after = (await bank<LenderReport>("GET", `lender/applicants/${ninoId}`)).body;
    expect(after.decisions.map((d) => d.decision)).toEqual(["approve", "request_info"]);
    const human = after.audit.filter((a) => a.action.startsWith("Human decision"));
    expect(human[0].action).toBe("Human decision: Approved up to $400/month");
    expect(human[0].detail).toMatch(/(Same as|Overrode) system suggestion/);
    // Reloading the same report (here, after each decision) is one visit, not three.
    expect(after.audit.filter((a) => a.action === "Opened report")).toHaveLength(1);

    // The freelancer sees the decision and the full audit trail.
    const mine = (await nino<{ decisions: { decision: string }[]; audit: { action: string }[] }>("GET", "shares")).body;
    expect(mine.decisions[0].decision).toBe("approve");
    expect(mine.audit.some((a) => a.action === "Opened report")).toBe(true);

    // Revoking ends access immediately.
    expect((await nino("POST", `shares/${shared.body.shareId}/revoke`, {})).status).toBe(200);
    expect((await bank("GET", `lender/applicants/${ninoId}`)).status).toBe(403);
    expect((await bank<unknown[]>("GET", "lender/applicants")).body).toEqual([]);
  });
});
