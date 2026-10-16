import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { analyzeIncome, bandFor, computeScoreReport, suggestDecision } from "@/lib/scoring";
import { CHECKERS, WORK_CHECK_POINTS } from "@/lib/checker/profiles";
import { checkCircularMoney, checkIncomeSpike, checkNameMismatch, checkUnmatchedInvoices } from "@/lib/scoring/fraud";
import { findCircularPairs, namesMatch } from "@/lib/scoring/income";
import { median, weightedMedian } from "@/lib/scoring/math";
import type { ActivityRecord, DataSource, FraudFlag, Transaction } from "@/lib/types";
import { emptyInput, tx } from "./helpers";

/** Monthly client payments for the 12 months before 2026-10-01. */
function steadyIncome(amounts: number[]): Transaction[] {
  return amounts.map((a, i) => {
    const m = String(((9 + i) % 12) + 1).padStart(2, "0");
    const y = 9 + i < 12 ? 2025 : 2026;
    return tx({ date: `${y}-${m}-10`, amount: a, direction: "in", category: "client_payment", counterparty: `Client ${i % 3}` });
  });
}

describe("math", () => {
  it("median & weighted median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(weightedMedian([100, 100, 100, 100, 900, 900], [1, 1, 1, 1, 0.5, 0.5])).toBe(100);
  });
});

describe("bands & decisions", () => {
  it("maps scores to bands", () => {
    expect(bandFor(740)).toBe("A");
    expect(bandFor(739)).toBe("B");
    expect(bandFor(670)).toBe("B");
    expect(bandFor(600)).toBe("C");
    expect(bandFor(530)).toBe("D");
    expect(bandFor(529)).toBe("E");
  });

  it("suggests decisions from thresholds and flags", () => {
    const high: FraudFlag = { type: "name_mismatch", severity: "high", title: "", explanation: "", transactionIds: [] };
    expect(suggestDecision(700, [])).toBe("approve");
    expect(suggestDecision(620, [])).toBe("review");
    expect(suggestDecision(500, [])).toBe("decline");
    expect(suggestDecision(720, [high])).toBe("review");
    expect(suggestDecision(720, [high, { ...high, type: "circular_money" }])).toBe("decline");
    expect(suggestDecision(650, [], { approveMinScore: 640, declineBelowScore: 500, declineHighFlags: 2 })).toBe("approve");
  });
});

describe("fraud: circular money", () => {
  it("pairs a P2P inflow with a similar outflow to the same person within 7 days", () => {
    const txs = [
      tx({ date: "2026-09-02", amount: 1500, direction: "in", category: "transfer_p2p", counterparty: "Giga" }),
      tx({ date: "2026-09-05", amount: 1460, direction: "out", category: "transfer_p2p", counterparty: "Giga" }),
      tx({ date: "2026-09-10", amount: 1800, direction: "in", category: "transfer_p2p", counterparty: "Mamuka" }),
      tx({ date: "2026-09-12", amount: 1800, direction: "out", category: "transfer_p2p", counterparty: "Mamuka" }),
      tx({ date: "2026-09-14", amount: 900, direction: "in", category: "transfer_p2p", counterparty: "Levan" }),
      tx({ date: "2026-09-30", amount: 900, direction: "out", category: "transfer_p2p", counterparty: "Levan" }), // 16 days later: not circular
      tx({ date: "2026-09-15", amount: 300, direction: "in", category: "transfer_p2p", counterparty: "Nika" }),
      tx({ date: "2026-09-16", amount: 150, direction: "out", category: "transfer_p2p", counterparty: "Nika" }), // amount differs
    ];
    expect(findCircularPairs(txs)).toHaveLength(2);
    const income = analyzeIncome(emptyInput({ transactions: txs }));
    const flag = checkCircularMoney(income);
    expect(flag?.severity).toBe("medium");
    expect(flag?.transactionIds).toHaveLength(4);
    // Circular inflows are excluded from verified income.
    const sep = income.months.find((m) => m.month === "2026-09");
    expect(sep?.gross).toBe(1500 + 1800 + 900 + 300);
    expect(sep?.verified).toBe(900 + 300);
  });

  it("does not flag a single round trip", () => {
    const txs = [
      tx({ date: "2026-09-02", amount: 100, direction: "in", category: "transfer_p2p", counterparty: "Mum" }),
      tx({ date: "2026-09-03", amount: 100, direction: "out", category: "transfer_p2p", counterparty: "Mum" }),
    ];
    expect(checkCircularMoney(analyzeIncome(emptyInput({ transactions: txs })))).toBeNull();
  });
});

describe("fraud: pre-application spike", () => {
  it("flags last-2-month income above 1.8× the prior 6-month median", () => {
    const input = emptyInput({ transactions: steadyIncome([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2500, 2600]) });
    const flag = checkIncomeSpike(input, analyzeIncome(input));
    expect(flag?.type).toBe("pre_application_spike");
    expect(flag?.severity).toBe("medium");
  });

  it("ignores gradual growth", () => {
    const input = emptyInput({ transactions: steadyIncome([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100]) });
    expect(checkIncomeSpike(input, analyzeIncome(input))).toBeNull();
  });
});

describe("Work Checker", () => {
  const weeks = (hours: number, type: "delivery_platform" | "salon_sensors" = "delivery_platform", signals: (h: number) => Record<string, number> = (h) => ({ orders: h * 2.2, km: h * 7, completed: h * 2.2, assigned: h * 2.25 })): ActivityRecord[] =>
    Array.from({ length: 16 }, (_, i) => ({ weekStart: addDays("2026-06-08", i * 7), sourceId: type === "salon_sensors" ? "sensors" : "p", hoursOnline: hours, tripsOrOrders: hours * 2, activeContracts: 0, rating: 4.8, distinctClients: 0, signals: signals(hours) }));
  const courier = (src: Partial<DataSource> = {}): DataSource => ({ ...emptyInput().sources[0], id: "p", type: "delivery_platform", provider: "Wolt Partner", tier: 3, accountHolderName: undefined, optional: true, ...src });

  it("rates regular work that explains the income as strong (+50)", () => {
    const input = emptyInput({ sources: [...emptyInput().sources, courier()], transactions: steadyIncome(Array(12).fill(1600)), activity: weeks(40) });
    const r = computeScoreReport(input);
    expect(r.workCheck.status).toBe("strong");
    expect(r.workCheckPoints).toBe(50);
    expect(r.fraudFlags.map((f) => f.type)).not.toContain("income_activity_mismatch");
  });

  it("flags work that cannot explain the income (−50 and a fraud flag)", () => {
    const input = emptyInput({ sources: [...emptyInput().sources, courier()], transactions: steadyIncome(Array(12).fill(4000)), activity: weeks(8) });
    const r = computeScoreReport(input);
    expect(r.workCheck.status).toBe("mismatch");
    expect(r.workCheckPoints).toBe(-50);
    const flag = r.fraudFlags.find((f) => f.type === "income_activity_mismatch");
    expect(flag?.severity).toBe("high");
  });

  it("costs 30 points when no work app is shared, more than weak evidence", () => {
    const r = computeScoreReport(emptyInput({ transactions: steadyIncome(Array(12).fill(1600)) }));
    expect(r.workCheck.status).toBe("not_shared");
    expect(r.workCheckPoints).toBe(-30);
    expect(WORK_CHECK_POINTS.weak).toBeGreaterThan(WORK_CHECK_POINTS.not_shared);
  });

  it("catches failed authenticity checks (e.g. sensors far below bookings)", () => {
    const base = emptyInput({ borrower: { id: "b", name: "Ana Test", workType: "beauty" } });
    const booking: DataSource = { ...courier(), id: "p", type: "booking_app", provider: "Booksy" };
    const sensor: DataSource = { ...courier(), id: "sensors", type: "salon_sensors", provider: "Salon sensors" };
    const appts = weeks(36, "delivery_platform", (h) => ({ appointments: h / 1.3, noShows: 1, clients: h / 1.6 })).map((a) => ({ ...a, sourceId: "p" }));
    const honest = weeks(0, "salon_sensors", () => ({ visitors: 36, hair: 15, nails: 10, otherServices: 3 }));
    const fake = weeks(0, "salon_sensors", () => ({ visitors: 8, hair: 3, nails: 2, otherServices: 0 }));
    const run = (sensorRows: ActivityRecord[]) =>
      computeScoreReport({ ...base, sources: [...base.sources, booking, sensor], transactions: steadyIncome(Array(12).fill(2000)), activity: [...appts, ...sensorRows] }).workCheck;
    expect(run(honest).evidence.find((e) => e.label === "Sensor services vs bookings")?.ok).toBe(true);
    const bad = run(fake);
    expect(bad.evidence.find((e) => e.label === "Sensor services vs bookings")?.ok).toBe(false);
    expect(bad.status).not.toBe("strong");
  });

  it("has no effect for professions without a checker", () => {
    const r = computeScoreReport(emptyInput({ borrower: { id: "b", name: "Ana Test", workType: "repair" }, transactions: steadyIncome(Array(12).fill(1600)) }));
    expect(r.workCheck.status).toBe("not_supported");
    expect(r.workCheckPoints).toBe(0);
  });

  it("defines six professions, each with apps and checks", () => {
    expect(CHECKERS.map((c) => c.workType).sort()).toEqual(["beauty", "delivery", "designer", "developer", "taxi", "tutor"]);
    for (const c of CHECKERS) {
      expect(c.sources.length).toBeGreaterThanOrEqual(2);
      expect(c.checks.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("fraud: invoices", () => {
  it("flags invoices with no matching payment, ignores matched and recent ones", () => {
    const input = emptyInput({
      transactions: [tx({ date: "2026-07-20", amount: 1200, direction: "in", category: "client_payment", counterparty: "Atlas" })],
      invoices: [
        { id: "i1", sourceId: "inv", date: "2026-07-05", client: "Atlas", amount: 1200 }, // matched
        { id: "i2", sourceId: "inv", date: "2026-07-01", client: "BuildMart", amount: 2000 },
        { id: "i3", sourceId: "inv", date: "2026-06-11", client: "BuildMart", amount: 1800 },
        { id: "i4", sourceId: "inv", date: "2026-09-25", client: "BuildMart", amount: 5000 }, // too recent
      ],
    });
    const flag = checkUnmatchedInvoices(input);
    expect(flag?.invoiceIds).toEqual(["i2", "i3"]);
    expect(flag?.severity).toBe("high");
  });
});

describe("fraud: name mismatch", () => {
  it("matches initials and surname, flags other holders", () => {
    expect(namesMatch("G. Beridze", "Giorgi Beridze")).toBe(true);
    expect(namesMatch("Irakli Gelashvili", "Dato Mchedlishvili")).toBe(false);
    const base = emptyInput();
    const input = emptyInput({ sources: [...base.sources, { ...base.sources[0], id: "bank2", accountHolderName: "Someone Else" }] });
    expect(checkNameMismatch(input, analyzeIncome(input))?.severity).toBe("high");
  });
});

describe("scorecard behaviour", () => {
  it("returns insufficient data with no income", () => {
    const r = computeScoreReport(emptyInput());
    expect(r.dataSufficiency).toBe("insufficient");
  });

  it("penalises gambling and rewards on-time bills", () => {
    const income = steadyIncome(Array(12).fill(2000));
    const base = computeScoreReport(emptyInput({ transactions: income }));
    const gamble = computeScoreReport(
      emptyInput({ transactions: [...income, ...Array.from({ length: 6 }, (_, i) => tx({ date: `2026-0${4 + i}-12`, amount: 400, direction: "out", category: "gambling" }))] }),
    );
    expect(gamble.reasons.find((r) => r.id === "gambling")?.impact).toBeLessThan(0);
    expect(gamble.score).toBeLessThan(base.score);

    const bills = Array.from({ length: 12 }, (_, i) => {
      const due = addDays("2025-10-20", i * 30);
      return { id: `o${i}`, sourceId: "u", kind: "utility" as const, provider: "P", amount: 50, dueDate: due, paidDate: addDays(due, -2) };
    });
    const withBills = computeScoreReport(emptyInput({ transactions: income, obligations: bills }));
    expect(withBills.reasons.find((r) => r.id === "bills")?.impact).toBe(50);
  });

  it("down-weights the two most recent months in verified income", () => {
    const r = computeScoreReport(emptyInput({ transactions: steadyIncome([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 3000, 3000]) }));
    expect(r.verifiedMonthlyIncome).toBe(1000);
  });
});
