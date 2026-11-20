import { prisma } from "../db";
import { addMonths, monthKey, monthWindow } from "../domain/period";
import { scoreBand } from "../domain/scoring";

/**
 * Public, aggregated map statistics per district or mandal (LGD code): average development
 * score for the latest scored month, ward and local-body counts and complaints reported that
 * month. No personal data. Cached for five minutes per layer and month.
 */
export type AreaStat = { score: number | null; band: string; wards: number; localBodies: number; reported: number; name: string; id: string };
const cache = new Map<string, { at: number; data: { asOf: string | null; areas: Record<string, AreaStat> } }>();

export async function areaStats(layer: "districts" | "mandals", month: Date) {
  const key = `${layer}:${monthKey(month)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return hit.data;
  const { start, end } = monthWindow(month);
  const latest = await prisma.scoreSnapshot.findFirst({ where: { period: { lte: start, gte: addMonths(start, -3) } }, orderBy: { period: "desc" }, select: { period: true } });
  const asOf = latest?.period ?? null;
  const rows = layer === "districts"
    ? await prisma.$queryRaw<Array<{ code: string; id: string; name: string; wards: number; lbs: number; score: number | null }>>`
        SELECT d."lgdCode" AS code, d."id" AS id, d."name" AS name, count(w."id")::int AS wards, count(DISTINCT lb."id")::int AS lbs, avg(s."score")::float AS score
        FROM "Ward" w JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "District" d ON d."id" = lb."districtId"
        LEFT JOIN "ScoreSnapshot" s ON s."wardId" = w."id" AND s."period" = ${asOf ?? new Date(0)}
        WHERE w."isActive" AND d."lgdCode" IS NOT NULL GROUP BY 1, 2, 3`
    : await prisma.$queryRaw<Array<{ code: string; id: string; name: string; wards: number; lbs: number; score: number | null }>>`
        SELECT sd."lgdCode" AS code, sd."districtId" AS id, sd."name" AS name, count(w."id")::int AS wards, count(DISTINCT lb."id")::int AS lbs, avg(s."score")::float AS score
        FROM "Ward" w JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "SubDistrict" sd ON sd."id" = lb."subDistrictId"
        LEFT JOIN "ScoreSnapshot" s ON s."wardId" = w."id" AND s."period" = ${asOf ?? new Date(0)}
        WHERE w."isActive" GROUP BY 1, 2, 3`;
  const reported = layer === "districts"
    ? await prisma.$queryRaw<Array<{ code: string; c: number }>>`SELECT d."lgdCode" AS code, count(*)::int AS c FROM "Complaint" x JOIN "Ward" w ON w."id" = x."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "District" d ON d."id" = lb."districtId" WHERE x."createdAt" >= ${start} AND x."createdAt" < ${end} GROUP BY 1`
    : await prisma.$queryRaw<Array<{ code: string; c: number }>>`SELECT sd."lgdCode" AS code, count(*)::int AS c FROM "Complaint" x JOIN "Ward" w ON w."id" = x."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "SubDistrict" sd ON sd."id" = lb."subDistrictId" WHERE x."createdAt" >= ${start} AND x."createdAt" < ${end} GROUP BY 1`;
  const rep = new Map(reported.map((r) => [r.code, r.c]));
  const areas: Record<string, AreaStat> = {};
  for (const r of rows) {
    const score = r.score == null ? null : Math.round(r.score * 10) / 10;
    areas[r.code] = { id: r.id, name: r.name, wards: r.wards, localBodies: r.lbs, score, band: scoreBand(score), reported: rep.get(r.code) ?? 0 };
  }
  const data = { asOf: asOf ? monthKey(asOf) : null, areas };
  cache.set(key, { at: Date.now(), data });
  return data;
}
