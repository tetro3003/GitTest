import { describe, expect, it } from "vitest";
import { buildScoringInput, sourceCatalogue } from "@/lib/mock/dataset";
import { getPersona } from "@/lib/mock/personas";
import { isActivitySource } from "@/lib/mock/sources";
import { computeScoreReport } from "@/lib/scoring";
import type { WorkType } from "@/lib/types";

const workApps = (id: string, wt?: WorkType) => sourceCatalogue(id, wt).filter((s) => isActivitySource(s.type)).map((s) => s.provider);

describe("work apps follow the chosen profession", () => {
  it("shows the persona's own apps for its own profession", () => {
    expect(workApps("giorgi")).toEqual(["Bolt Driver", "Uber Driver"]);
  });

  it("shows GitHub and Jira (not Bolt) when a taxi persona picks software developer", () => {
    expect(workApps("giorgi", "developer")).toEqual(["GitHub", "Jira"]);
  });

  it.each<[WorkType, string[]]>([
    ["designer", ["Figma", "Adobe Photoshop", "Adobe Illustrator"]],
    ["tutor", ["Zoom", "Google Meet", "Offline lesson audio"]],
    ["beauty", ["Booksy", "Fresha", "Salon sensors"]],
    ["delivery", ["Wolt Partner", "Glovo Courier"]],
  ])("lists the %s apps", (wt, apps) => {
    expect(workApps("giorgi", wt)).toEqual(apps);
  });

  it("keeps bank and bill sources when switching", () => {
    const types = sourceCatalogue("giorgi", "developer").map((s) => s.type);
    expect(types).toEqual(expect.arrayContaining(["bank", "utility", "mobile_operator"]));
  });

  it("new profession's apps start disconnected, then produce evidence once connected", () => {
    const p = getPersona("giorgi");
    if (!p) throw new Error("missing persona");
    const def = { ...p, borrower: { ...p.borrower, workType: "developer" as const } };
    const catalogue = sourceCatalogue("giorgi", "developer");
    expect(catalogue.filter((s) => isActivitySource(s.type)).every((s) => s.status === "available")).toBe(true);
    const before = computeScoreReport(buildScoringInput(def, catalogue));
    expect(before.workCheck.status).toBe("not_shared");
    const connected = catalogue.map((s) => (isActivitySource(s.type) ? { ...s, status: "connected" as const } : s));
    const after = computeScoreReport(buildScoringInput(def, connected));
    expect(after.workCheck.sourcesUsed).toEqual(["GitHub", "Jira"]);
    expect(["strong", "moderate"]).toContain(after.workCheck.status);
    expect(after.score).toBeGreaterThan(before.score);
  });
});
