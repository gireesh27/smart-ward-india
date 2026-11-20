// Development score engine. Pure module — see docs/SCORING.md for the method.

export type IndicatorDef = {
  key: string;
  name?: string;
  weight: number;        // relative weight, any positive number
  target: number;        // value that earns 100 points
  worst: number;         // value that earns 0 points
  higherIsBetter: boolean;
};

export type Contribution = {
  key: string;
  value: number | null;
  normalized: number | null; // 0–100
  weight: number;
  points: number | null;     // share of the final score contributed by this indicator
};

export type ScoreResult = {
  score: number | null;      // 0–100, null when coverage is insufficient
  coverage: number;          // 0–1, share of total weight with data
  status: "ok" | "insufficient_data";
  contributions: Contribution[];
};

export const DEFAULT_MIN_COVERAGE = 0.6;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function normalize(value: number, def: IndicatorDef): number {
  const span = def.target - def.worst;
  if (span === 0) return value === def.target ? 100 : 0;
  // Same formula covers both directions because span is negative when lower is better.
  return clamp(((value - def.worst) / span) * 100);
}

export function computeScore(
  defs: IndicatorDef[],
  values: Record<string, number | null | undefined>,
  minCoverage: number = DEFAULT_MIN_COVERAGE,
): ScoreResult {
  const totalWeight = defs.reduce((s, d) => s + Math.max(0, d.weight), 0);
  const present = defs.filter((d) => typeof values[d.key] === "number" && Number.isFinite(values[d.key] as number) && d.weight > 0);
  const presentWeight = present.reduce((s, d) => s + d.weight, 0);
  const coverage = totalWeight > 0 ? presentWeight / totalWeight : 0;

  const contributions: Contribution[] = defs.map((d) => {
    const v = values[d.key];
    if (typeof v !== "number" || !Number.isFinite(v) || d.weight <= 0) {
      return { key: d.key, value: null, normalized: null, weight: d.weight, points: null };
    }
    const n = normalize(v, d);
    return { key: d.key, value: v, normalized: round1(n), weight: d.weight, points: round1((n * d.weight) / presentWeight) };
  });

  if (presentWeight === 0 || coverage + 1e-9 < minCoverage) {
    return { score: null, coverage: round1(coverage * 100) / 100, status: "insufficient_data", contributions };
  }
  const score = present.reduce((s, d) => s + normalize(values[d.key] as number, d) * d.weight, 0) / presentWeight;
  return { score: round1(score), coverage: Math.round(coverage * 100) / 100, status: "ok", contributions };
}

/** Mean of available scores; null when none are available. */
export function aggregateScores(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  if (valid.length === 0) return null;
  return round1(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Relative change in percent (for counts). Null when the baseline is missing or zero. */
export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

/** Absolute change in points (for scores and rates). */
export function pointChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null;
  return round1(current - previous);
}

export type Band = "Excellent" | "Good" | "Needs Attention" | "Critical" | "Insufficient data";
export function scoreBand(score: number | null | undefined): Band {
  if (score == null) return "Insufficient data";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Needs Attention";
  return "Critical";
}

/** Resolution rate = resolved in period ÷ reported in period, capped at 100. */
export function resolutionRate(resolved: number, reported: number): number | null {
  if (reported <= 0) return null;
  return round1(Math.min(100, (resolved / reported) * 100));
}
