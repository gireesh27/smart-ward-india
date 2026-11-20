import { describe, expect, it } from "vitest";
import { evaluateRules, DEFAULT_THRESHOLDS } from "@/lib/domain/insights";

const base = { wardLabel: "Ward 12, Machilipatnam", newLast30: 0, newPrev30: 1, open: 1, overdue: 0, last90: 1 };

describe("rule-based insights", () => {
  it("flags rising water complaints with evidence and a link to the records", () => {
    const [i] = evaluateRules([{ ...base, wardId: "w", categoryId: "c", categorySlug: "water", categoryName: "Water", newLast30: 5 }]);
    expect(i.ruleKey).toBe("WATER_SUPPLY_RISK");
    expect(i.severity).toBe("HIGH");
    expect(i.evidence).toMatchObject({ newLast30: 5, newPrev30: 1 });
    expect(i.link).toContain("/admin/complaints?ward=w&category=c");
  });
  it("does not fire on normal volumes", () => {
    expect(evaluateRules([{ ...base, wardId: "w", categoryId: "c", categorySlug: "water", categoryName: "Water", newLast30: 2 }])).toEqual([]);
  });
  it("prioritises overdue road repairs and recommends drainage reviews", () => {
    const res = evaluateRules([
      { ...base, wardId: "w", categoryId: "r", categorySlug: "roads", categoryName: "Roads", overdue: DEFAULT_THRESHOLDS.roadOverdueMin, open: 4 },
      { ...base, wardId: "w", categoryId: "d", categorySlug: "drainage", categoryName: "Drainage", last90: DEFAULT_THRESHOLDS.drainageRepeatHigh },
    ]);
    expect(res.map((r) => [r.ruleKey, r.severity])).toEqual([["DRAINAGE_REVIEW", "HIGH"], ["ROAD_REPAIR_PRIORITY", "MEDIUM"]]);
  });
  it("produces stable fingerprints so re-runs update rather than duplicate", () => {
    const s = [{ ...base, wardId: "w", categoryId: "c", categorySlug: "water", categoryName: "Water", newLast30: 9 }];
    expect(evaluateRules(s)[0].fingerprint).toBe(evaluateRules(s)[0].fingerprint);
  });
});
