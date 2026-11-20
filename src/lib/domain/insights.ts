// Rule-based insights. Deterministic: same inputs → same outputs. Not a forecast.

export type WardCategoryStats = {
  wardId: string;
  wardLabel: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  newLast30: number;
  newPrev30: number;
  open: number;
  overdue: number;
  last90: number;
};

export type InsightThresholds = {
  waterMinNew: number;          // minimum new water complaints in 30 days
  waterGrowthFactor: number;    // last30 ≥ factor × prev30
  waterOpenHigh: number;        // unresolved water complaints that alone trigger
  roadOverdueMin: number;
  roadOverdueHigh: number;
  drainageRepeatMin: number;    // drainage complaints in 90 days
  drainageRepeatHigh: number;
  backlogMinOpen: number;
  backlogOverdueShare: number;  // 0–1
};

export const DEFAULT_THRESHOLDS: InsightThresholds = {
  waterMinNew: 4,
  waterGrowthFactor: 1.5,
  waterOpenHigh: 10,
  roadOverdueMin: 3,
  roadOverdueHigh: 6,
  drainageRepeatMin: 6,
  drainageRepeatHigh: 10,
  backlogMinOpen: 4,
  backlogOverdueShare: 0.5,
};

export type InsightDraft = {
  ruleKey: "WATER_SUPPLY_RISK" | "ROAD_REPAIR_PRIORITY" | "DRAINAGE_REVIEW" | "SERVICE_BACKLOG";
  fingerprint: string;
  wardId: string;
  categoryId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  summary: string;
  evidence: Record<string, number | string>;
  suggestedAction: string;
  link: string;
};

function linkFor(s: WardCategoryStats, extra = "") {
  return `/admin/complaints?ward=${encodeURIComponent(s.wardId)}&category=${encodeURIComponent(s.categoryId)}&status=open${extra}`;
}

export function evaluateRules(stats: WardCategoryStats[], t: InsightThresholds = DEFAULT_THRESHOLDS): InsightDraft[] {
  const out: InsightDraft[] = [];
  for (const s of stats) {
    const fp = (rule: string) => `${rule}:${s.wardId}:${s.categoryId}`;

    if (s.categorySlug === "water") {
      const growing = s.newLast30 >= t.waterMinNew && s.newLast30 >= t.waterGrowthFactor * Math.max(1, s.newPrev30);
      const backlog = s.open >= t.waterOpenHigh;
      if (growing || backlog) {
        const doubled = s.newLast30 >= 2 * Math.max(1, s.newPrev30);
        out.push({
          ruleKey: "WATER_SUPPLY_RISK",
          fingerprint: fp("WATER_SUPPLY_RISK"),
          wardId: s.wardId,
          categoryId: s.categoryId,
          severity: backlog || doubled ? "HIGH" : "MEDIUM",
          title: "Water supply risk",
          summary: `${s.wardLabel}: ${s.newLast30} water complaints in the last 30 days (previous 30 days: ${s.newPrev30}); ${s.open} still unresolved.`,
          evidence: { newLast30: s.newLast30, newPrev30: s.newPrev30, open: s.open, window: "30 days" },
          suggestedAction: "Inspect supply lines and storage in this ward and schedule tanker support until complaints fall.",
          link: linkFor(s),
        });
      }
    }

    if (s.categorySlug === "roads" && s.overdue >= t.roadOverdueMin) {
      out.push({
        ruleKey: "ROAD_REPAIR_PRIORITY",
        fingerprint: fp("ROAD_REPAIR_PRIORITY"),
        wardId: s.wardId,
        categoryId: s.categoryId,
        severity: s.overdue >= t.roadOverdueHigh ? "HIGH" : "MEDIUM",
        title: "Prioritise road repairs",
        summary: `${s.wardLabel}: ${s.overdue} road complaints are past their service deadline (${s.open} open).`,
        evidence: { overdue: s.overdue, open: s.open },
        suggestedAction: "Batch the overdue road complaints into one repair work order and assign a crew this week.",
        link: linkFor(s, "&overdue=1"),
      });
    }

    if (s.categorySlug === "drainage" && s.last90 >= t.drainageRepeatMin) {
      out.push({
        ruleKey: "DRAINAGE_REVIEW",
        fingerprint: fp("DRAINAGE_REVIEW"),
        wardId: s.wardId,
        categoryId: s.categoryId,
        severity: s.last90 >= t.drainageRepeatHigh ? "HIGH" : "MEDIUM",
        title: "Drainage review recommended",
        summary: `${s.wardLabel}: ${s.last90} drainage complaints in 90 days suggests a recurring blockage or capacity problem.`,
        evidence: { last90: s.last90, open: s.open, window: "90 days" },
        suggestedAction: "Commission a drainage system review and desilting before the next monsoon.",
        link: linkFor(s),
      });
    }

    if (
      !["water", "roads", "drainage"].includes(s.categorySlug) &&
      s.open >= t.backlogMinOpen &&
      s.overdue / Math.max(1, s.open) >= t.backlogOverdueShare
    ) {
      out.push({
        ruleKey: "SERVICE_BACKLOG",
        fingerprint: fp("SERVICE_BACKLOG"),
        wardId: s.wardId,
        categoryId: s.categoryId,
        severity: "MEDIUM",
        title: `${s.categoryName} backlog`,
        summary: `${s.wardLabel}: ${s.overdue} of ${s.open} open ${s.categoryName.toLowerCase()} complaints are overdue.`,
        evidence: { overdue: s.overdue, open: s.open },
        suggestedAction: `Review staffing for ${s.categoryName.toLowerCase()} in this ward and clear the overdue queue.`,
        link: linkFor(s, "&overdue=1"),
      });
    }
  }
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.fingerprint.localeCompare(b.fingerprint));
}
