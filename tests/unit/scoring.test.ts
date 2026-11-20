import { describe, expect, it } from "vitest";
import { aggregateScores, computeScore, normalize, percentChange, pointChange, resolutionRate, scoreBand } from "@/lib/domain/scoring";

const defs = [
  { key: "water", weight: 25, target: 100, worst: 0, higherIsBetter: true },
  { key: "roads", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "drainage", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "sanitation", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "health", weight: 15, target: 100, worst: 0, higherIsBetter: true },
];

describe("development score", () => {
  it("is the weighted mean of normalised indicators", () => {
    const r = computeScore(defs, { water: 90, roads: 75, drainage: 80, sanitation: 85, health: 70 });
    expect(r.score).toBe(81);
    expect(r.coverage).toBe(1);
    expect(r.contributions.reduce((s, c) => s + (c.points ?? 0), 0)).toBeCloseTo(81, 0);
  });
  it("re-weights over available data and refuses to guess below the coverage threshold", () => {
    expect(computeScore(defs, { water: 90, roads: 70, drainage: 80 }).score).toBe(80.8);
    const sparse = computeScore(defs, { water: 90 });
    expect(sparse.status).toBe("insufficient_data");
    expect(sparse.score).toBeNull();
  });
  it("handles lower-is-better indicators and clamps out-of-range values", () => {
    expect(normalize(5, { key: "x", weight: 1, target: 0, worst: 20, higherIsBetter: false })).toBe(75);
    expect(normalize(150, defs[0])).toBe(100);
    expect(normalize(-5, defs[0])).toBe(0);
  });
  it("calculates changes and bands", () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(10, 0)).toBeNull();
    expect(pointChange(82.5, 79.3)).toBe(3.2);
    expect([92.1, 85.7, 76.4, 68.9, null].map(scoreBand)).toEqual(["Excellent", "Good", "Needs Attention", "Critical", "Insufficient data"]);
    expect(resolutionRate(3421, 3892)).toBe(87.9);
    expect(aggregateScores([null, null])).toBeNull();
  });
});
