import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { computeScore, type IndicatorDef } from "../domain/scoring";
import { monthKey } from "../domain/period";
import { getMinCoverage } from "../settings";

export async function activeIndicatorDefs(): Promise<Array<IndicatorDef & { id: string; name: string; unit: string; icon: string }>> {
  const rows = await prisma.indicatorDefinition.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, unit: r.unit, icon: r.icon, weight: r.weight, target: r.target, worst: r.worst, higherIsBetter: r.higherIsBetter }));
}

/**
 * Recompute ScoreSnapshot rows from stored IndicatorReadings.
 * Pass wardIds/periods to limit the work; omit both to rebuild everything.
 */
export async function recomputeSnapshots(opts: { wardIds?: string[]; periods?: Date[]; replaceAll?: boolean } = {}) {
  const defs = await activeIndicatorDefs();
  const minCoverage = await getMinCoverage();
  const compute = async (where: Prisma.IndicatorReadingWhereInput) => {
    const readings = await prisma.indicatorReading.findMany({ where, select: { wardId: true, period: true, value: true, indicator: { select: { key: true } } } });
    const groups = new Map<string, { wardId: string; period: Date; values: Record<string, number> }>();
    for (const r of readings) {
      const k = `${r.wardId}|${monthKey(r.period)}`;
      const g = groups.get(k) ?? { wardId: r.wardId, period: r.period, values: {} };
      g.values[r.indicator.key] = r.value;
      groups.set(k, g);
    }
    return [...groups.values()].map((g) => {
      const res = computeScore(defs, g.values, minCoverage);
      return { wardId: g.wardId, period: g.period, score: res.score, coverage: res.coverage, breakdown: res.contributions as unknown as Prisma.InputJsonValue };
    });
  };
  if (opts.replaceAll && !opts.wardIds && !opts.periods) {
    // Full rebuild (seed, scoring-weight changes): replace everything, 300 wards at a time to bound memory.
    await prisma.scoreSnapshot.deleteMany({});
    const wardIds = (await prisma.indicatorReading.groupBy({ by: ["wardId"] })).map((r) => r.wardId);
    let total = 0;
    for (let i = 0; i < wardIds.length; i += 300) {
      const rows = await compute({ indicator: { isActive: true }, wardId: { in: wardIds.slice(i, i + 300) } });
      for (let j = 0; j < rows.length; j += 5000) await prisma.scoreSnapshot.createMany({ data: rows.slice(j, j + 5000) });
      total += rows.length;
    }
    return { snapshots: total };
  }
  const where: Prisma.IndicatorReadingWhereInput = { indicator: { isActive: true } };
  if (opts.wardIds) where.wardId = { in: opts.wardIds };
  if (opts.periods) where.period = { in: opts.periods };
  const rows = await compute(where);
  // Upsert in chunks to keep transactions small.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await prisma.$transaction(chunk.map((r) => prisma.scoreSnapshot.upsert({
      where: { wardId_period: { wardId: r.wardId, period: r.period } },
      create: r,
      update: { score: r.score, coverage: r.coverage, breakdown: r.breakdown, computedAt: new Date() },
    })));
  }
  return { snapshots: rows.length };
}
