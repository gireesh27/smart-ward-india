import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { OPEN_STATUSES } from "../domain/status";
import { evaluateRules, type WardCategoryStats } from "../domain/insights";
import { getInsightThresholds, getSetting, setSetting } from "../settings";
import { log } from "../logger";
import type { ComplaintStatus } from "@prisma/client";

const DAY = 86_400_000;

/** Re-evaluate every rule against current complaint data and sync the Insight table. */
export async function generateInsights(now: Date = new Date()) {
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);
  const d90 = new Date(now.getTime() - 90 * DAY);
  const open = [...OPEN_STATUSES] as ComplaintStatus[];
  const by = ["wardId", "categoryId"] as const;

  const [wards, categories, last30, prev30, openG, overdueG, last90] = await Promise.all([
    Promise.resolve([] as Array<{ id: string; number: number; localBody: { name: string } }>),
    prisma.category.findMany({ select: { id: true, slug: true, name: true } }),
    prisma.complaint.groupBy({ by: [...by], where: { createdAt: { gte: d30, lt: now } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: [...by], where: { createdAt: { gte: d60, lt: d30 } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: [...by], where: { status: { in: open } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: [...by], where: { status: { in: open }, dueAt: { lt: now } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: [...by], where: { createdAt: { gte: d90, lt: now } }, _count: { _all: true } }),
  ]);

  // Label only wards that have activity (a full ward list would be 245,000 rows).
  const activeIds = [...new Set([...last30, ...prev30, ...openG, ...overdueG, ...last90].map((r) => r.wardId))];
  for (let i = 0; i < activeIds.length; i += 5000) {
    wards.push(...(await prisma.ward.findMany({ where: { id: { in: activeIds.slice(i, i + 5000) }, isActive: true }, select: { id: true, number: true, localBody: { select: { name: true } } } })));
  }
  const wardLabel = new Map(wards.map((w) => [w.id, `Ward ${w.number}, ${w.localBody.name}`]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const stats = new Map<string, WardCategoryStats>();
  const touch = (wardId: string, categoryId: string) => {
    const k = `${wardId}|${categoryId}`;
    let s = stats.get(k);
    if (!s) {
      const c = cat.get(categoryId);
      if (!c || !wardLabel.has(wardId)) return null;
      s = { wardId, wardLabel: wardLabel.get(wardId)!, categoryId, categorySlug: c.slug, categoryName: c.name, newLast30: 0, newPrev30: 0, open: 0, overdue: 0, last90: 0 };
      stats.set(k, s);
    }
    return s;
  };
  const fill = (rows: Array<{ wardId: string; categoryId: string; _count: { _all: number } }>, field: keyof Pick<WardCategoryStats, "newLast30" | "newPrev30" | "open" | "overdue" | "last90">) => {
    for (const r of rows) { const s = touch(r.wardId, r.categoryId); if (s) s[field] = r._count._all; }
  };
  fill(last30, "newLast30"); fill(prev30, "newPrev30"); fill(openG, "open"); fill(overdueG, "overdue"); fill(last90, "last90");

  const drafts = evaluateRules([...stats.values()], await getInsightThresholds());
  const existing = await prisma.insight.findMany({ where: { fingerprint: { in: drafts.map((d) => d.fingerprint) } }, select: { fingerprint: true, status: true } });
  const prevStatus = new Map(existing.map((e) => [e.fingerprint, e.status]));

  await prisma.$transaction([
    ...drafts.map((d) => prisma.insight.upsert({
      where: { fingerprint: d.fingerprint },
      create: { ...d, evidence: d.evidence as Prisma.InputJsonValue, generatedAt: now },
      update: {
        severity: d.severity, title: d.title, summary: d.summary, evidence: d.evidence as Prisma.InputJsonValue,
        suggestedAction: d.suggestedAction, link: d.link, generatedAt: now,
        // A dismissed insight stays dismissed; a previously resolved one re-opens because the condition is back.
        status: prevStatus.get(d.fingerprint) === "DISMISSED" ? "DISMISSED" : prevStatus.get(d.fingerprint) === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "OPEN",
      },
    })),
    // Conditions that no longer hold are closed automatically.
    prisma.insight.updateMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, fingerprint: { notIn: drafts.map((d) => d.fingerprint) } },
      data: { status: "RESOLVED" },
    }),
  ]);
  await setSetting("insights.lastRun", now.toISOString(), null);
  return { active: drafts.length };
}

/** Refresh at most once an hour when a dashboard is opened. */
export async function maybeRefreshInsights() {
  const last = await getSetting<string | null>("insights.lastRun", null);
  if (!last || Date.now() - new Date(last).getTime() > 60 * 60 * 1000) {
    try { await generateInsights(); } catch (err) { log.error("insights.refresh_failed", { err }); }
  }
}

