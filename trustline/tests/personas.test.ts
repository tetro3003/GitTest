import { describe, expect, it } from "vitest";
import { bandFor } from "@/lib/scoring";
import { reportFor, withoutActivity } from "./helpers";

const types = (id: string) => reportFor(id).fraudFlags.map((f) => f.type).sort();

describe("demo personas", () => {
  it("Giorgi — stable taxi driver lands in A/B with no flags", () => {
    const r = reportFor("giorgi");
    expect(["A", "B"]).toContain(r.band);
    expect(r.fraudFlags).toEqual([]);
    expect(r.decision).toBe("approve");
    expect(r.verifiedMonthlyIncome).toBeGreaterThan(2200);
    expect(r.verifiedMonthlyIncome).toBeLessThan(2900);
  });

  it("Nino — growing IT freelancer lands in B with a growing trend", () => {
    const r = reportFor("nino");
    expect(r.band).toBe("B");
    expect(r.features.trend).toBe("growing");
    expect(r.features.incomeSourceCount).toBeGreaterThanOrEqual(3);
    expect(r.fraudFlags).toEqual([]);
  });

  it("Levan — seasonal tutor lands in C with seasonality detected", () => {
    const r = reportFor("levan");
    expect(r.band).toBe("C");
    expect(r.features.seasonal).toBe(true);
    expect(r.features.zeroIncomeMonths).toBeGreaterThanOrEqual(2);
    expect(r.reasons.find((x) => x.id === "zero_months")?.plain).toMatch(/same months as last year/);
    // Judged on the teaching season, so summer doesn't make the evidence weak.
    expect(r.workCheck.status).toBe("strong");
    expect(r.fraudFlags).toEqual([]);
  });

  it("Sandro — new courier is lifted from D to C by the Work Checker", () => {
    const withAct = reportFor("sandro");
    const noAct = reportFor("sandro", withoutActivity);
    expect(noAct.band).toMatch(/[DE]/);
    expect(noAct.workCheck.status).toBe("not_shared");
    expect(withAct.band).toBe("C");
    expect(withAct.workCheck.status).toBe("strong");
    expect(withAct.scoreWithoutActivity).toBe(noAct.score);
    expect(withAct.dataSufficiency).toBe("limited");
  });

  it("Mariam — designer: Figma + Adobe evidence is strong", () => {
    const r = reportFor("mariam");
    expect(["A", "B"]).toContain(r.band);
    expect(r.workCheck.status).toBe("strong");
    expect(r.workCheck.sourcesUsed).toEqual(expect.arrayContaining(["Figma", "Adobe Photoshop", "Adobe Illustrator"]));
  });

  it("Keti — beauty: bookings agree with salon sensors", () => {
    const r = reportFor("keti");
    expect(["A", "B"]).toContain(r.band);
    expect(r.workCheck.status).toBe("strong");
    expect(r.workCheck.evidence.find((e) => e.label === "Sensor services vs bookings")?.ok).toBe(true);
  });

  it("Dato — fraud case raises all five flags and lands in band D at best", () => {
    const r = reportFor("dato");
    expect(types("dato")).toEqual(["circular_money", "income_activity_mismatch", "name_mismatch", "pre_application_spike", "unmatched_invoices"].sort());
    expect(r.fraudFlags.some((f) => f.severity === "high")).toBe(true);
    expect(r.score).toBeLessThanOrEqual(599);
    expect(["D", "E"]).toContain(r.band);
    expect(r.decision).toBe("decline");
    expect(r.recommendedMaxPayment).toBe(0);
    expect(r.workCheck.status).toBe("mismatch");
    expect(r.workCheckPoints).toBe(-50);
    // Circular inflows and the foreign account are excluded from verified income.
    expect(r.features.verifiedMonthlyIncome).toBeLessThan(r.features.grossMonthlyIncome);
  });

  it("honest personas never raise fraud flags", () => {
    for (const id of ["giorgi", "nino", "levan", "sandro", "mariam", "keti"]) expect(types(id)).toEqual([]);
  });
});

describe("engine guarantees on personas", () => {
  const ids = ["giorgi", "nino", "levan", "sandro", "dato", "mariam", "keti", "tamar", "beka", "irakli", "ana", "luka", "giga"];

  it("is deterministic", () => {
    expect(reportFor("nino")).toEqual(reportFor("nino"));
  });

  it("for honest workers, sharing work evidence never scores worse than hiding it", () => {
    for (const id of ids.filter((x) => x !== "dato")) {
      const a = reportFor(id);
      const b = reportFor(id, withoutActivity);
      expect(a.uncappedScore).toBeGreaterThanOrEqual(b.uncappedScore);
    }
  });

  it("professions without their own profile use the universal checker", () => {
    const r = reportFor("irakli");
    expect(r.workCheck.profession).toBe("Repair worker");
    expect(r.workCheck.status).toBe("not_shared");
  });

  it("score always within 300–850, band consistent, reasons sum to score", () => {
    for (const id of ids) {
      const r = reportFor(id);
      expect(r.score).toBeGreaterThanOrEqual(300);
      expect(r.score).toBeLessThanOrEqual(850);
      expect(r.band).toBe(bandFor(r.score));
      const sum = r.baseScore + r.reasons.reduce((a, x) => a + x.impact, 0);
      expect(Math.min(850, Math.max(300, sum))).toBe(r.uncappedScore);
    }
  });

  it("recommended payment is 40% of free cash flow (rounded to 10)", () => {
    const r = reportFor("giorgi");
    expect(Math.abs(r.recommendedMaxPayment - r.features.freeCashFlow * 0.4)).toBeLessThanOrEqual(5);
  });

  it("flags an activity decline as an early warning", () => {
    const r = reportFor("tamar");
    expect(r.earlyWarnings.map((w) => w.type)).toContain("activity_decline");
  });
});
