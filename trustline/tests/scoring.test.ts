import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { analyzeIncome, bandFor, computeScoreReport, suggestDecision } from "@/lib/scoring";
import { checkCircularMoney, checkIncomeActivityMismatch, checkIncomeSpike, checkNameMismatch, checkUnmatchedInvoices } from "@/lib/scoring/fraud";
import { extractFeatures } from "@/lib/scoring/features";
import { findCircularPairs, namesMatch } from "@/lib/scoring/income";
import { median, weightedMedian } from "@/lib/scoring/math";
import type { ActivityRecord, FraudFlag, Transaction } from "@/lib/types";
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

describe("fraud: income vs activity", () => {
  const weeks = (hours: number): ActivityRecord[] =>
    Array.from({ length: 16 }, (_, i) => ({ weekStart: addDays("2026-06-08", i * 7), sourceId: "p", hoursOnline: hours, tripsOrOrders: hours * 2, activeContracts: 0, rating: 4.8, distinctClients: 0 }));

  it("flags implausible earnings per online hour", () => {
    const input = emptyInput({ transactions: steadyIncome(Array(12).fill(4000)), activity: weeks(8) });
    const income = analyzeIncome(input);
    const flag = checkIncomeActivityMismatch(input, income, extractFeatures(input, income));
    expect(flag?.severity).toBe("high");
  });

  it("accepts earnings consistent with hours", () => {
    const input = emptyInput({ transactions: steadyIncome(Array(12).fill(1600)), activity: weeks(40) });
    const income = analyzeIncome(input);
    expect(checkIncomeActivityMismatch(input, income, extractFeatures(input, income))).toBeNull();
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
