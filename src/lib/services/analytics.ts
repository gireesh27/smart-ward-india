import { Prisma, type ComplaintStatus } from "@prisma/client";
import { prisma } from "../db";
import { wardScopeSql, wardScopeWhere, districtScopeWhere, type Actor } from "../authz";
import { addMonths, lastNMonths, monthKey, monthLabel, monthWindow } from "../domain/period";
import { normalize, percentChange, pointChange, resolutionRate, scoreBand, type Contribution } from "../domain/scoring";
import { OPEN_STATUSES } from "../domain/status";
import { activeIndicatorDefs } from "./scores";

/*
 * All aggregation filters through relations or SQL joins — never through
 * materialised ward-id lists — so a state with 245,000 wards (and a district
 * admin covering 17,000 of them) stays within database limits.
 */
export type GeoFilter = { stateId?: string; districtId?: string; localBodyId?: string; wardId?: string };
const OPEN = [...OPEN_STATUSES] as ComplaintStatus[];
const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

export function wardWhere(actor: Actor | null, f: GeoFilter): Prisma.WardWhereInput {
  const and: Prisma.WardWhereInput[] = [{ isActive: true }];
  if (actor) and.push(wardScopeWhere(actor));
  if (f.wardId) and.push({ id: f.wardId });
  if (f.localBodyId) and.push({ localBodyId: f.localBodyId });
  if (f.districtId) and.push({ localBody: { districtId: f.districtId } });
  if (f.stateId) and.push({ localBody: { district: { stateId: f.stateId } } });
  return { AND: and };
}

/** WHERE fragment for queries joining "Ward" w, "LocalBody" lb, "District" d. */
function filterSql(actor: Actor | null, f: GeoFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`w."isActive"`, wardScopeSql(actor)];
  if (f.wardId) parts.push(Prisma.sql`w."id" = ${f.wardId}`);
  if (f.localBodyId) parts.push(Prisma.sql`w."localBodyId" = ${f.localBodyId}`);
  if (f.districtId) parts.push(Prisma.sql`lb."districtId" = ${f.districtId}`);
  if (f.stateId) parts.push(Prisma.sql`d."stateId" = ${f.stateId}`);
  return Prisma.join(parts, " AND ");
}
const JOINS = Prisma.sql`JOIN "Ward" w ON w."id" = x."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "District" d ON d."id" = lb."districtId"`;

/** Most recent score period ≤ month (within 3 months), so stale data is labelled rather than hidden. */
export async function latestScorePeriod(ww: Prisma.WardWhereInput, month: Date): Promise<Date | null> {
  const row = await prisma.scoreSnapshot.findFirst({ where: { ward: ww, period: { lte: month, gte: addMonths(month, -3) } }, orderBy: { period: "desc" }, select: { period: true } });
  return row?.period ?? null;
}

async function avgScore(ww: Prisma.WardWhereInput, period: Date | null): Promise<number | null> {
  if (!period) return null;
  const r = await prisma.scoreSnapshot.aggregate({ where: { ward: ww, period, score: { not: null } }, _avg: { score: true } });
  return round1(r._avg.score);
}

type MonthCount = { m: Date; c: number };
type MonthAvg = { m: Date; a: number; c: number };

export async function trendSeries(actor: Actor | null, f: GeoFilter, endMonth: Date, months: number) {
  const ms = lastNMonths(endMonth, months);
  const from = ms[0];
  const to = addMonths(ms[ms.length - 1], 1);
  const cond = filterSql(actor, f);
  const [scores, reported, resolved, sat] = await Promise.all([
    prisma.scoreSnapshot.groupBy({ by: ["period"], where: { ward: wardWhere(actor, f), period: { gte: from, lt: to }, score: { not: null } }, _avg: { score: true } }),
    prisma.$queryRaw<MonthCount[]>`SELECT date_trunc('month', x."createdAt") AS m, count(*)::int AS c FROM "Complaint" x ${JOINS} WHERE ${cond} AND x."createdAt" >= ${from} AND x."createdAt" < ${to} GROUP BY 1`,
    prisma.$queryRaw<MonthCount[]>`SELECT date_trunc('month', x."resolvedAt") AS m, count(*)::int AS c FROM "Complaint" x ${JOINS} WHERE ${cond} AND x."resolvedAt" >= ${from} AND x."resolvedAt" < ${to} GROUP BY 1`,
    prisma.$queryRaw<MonthAvg[]>`SELECT date_trunc('month', fb."createdAt") AS m, avg(fb."rating")::float AS a, count(*)::int AS c FROM "ComplaintFeedback" fb JOIN "Complaint" x ON x."id" = fb."complaintId" ${JOINS} WHERE ${cond} AND fb."createdAt" >= ${from} AND fb."createdAt" < ${to} GROUP BY 1`,
  ]);
  const byKey = <T extends { m: Date }>(rows: T[]) => new Map(rows.map((r) => [monthKey(new Date(r.m)), r]));
  const rep = byKey(reported), res = byKey(resolved), s = byKey(sat);
  const sc = new Map(scores.map((r) => [monthKey(r.period), r._avg.score]));
  return ms.map((m) => {
    const k = monthKey(m);
    const nRep = rep.get(k)?.c ?? 0, nRes = res.get(k)?.c ?? 0, satRow = s.get(k);
    return { month: k, label: monthLabel(m), devScore: round1(sc.get(k) ?? null), resolution: resolutionRate(nRes, nRep), satisfaction: satRow && satRow.c > 0 ? round1(satRow.a * 20) : null, reported: nRep, resolved: nRes };
  });
}

export async function indicatorAverages(ww: Prisma.WardWhereInput, period: Date | null) {
  const defs = await activeIndicatorDefs();
  const avgs = period ? await prisma.indicatorReading.groupBy({ by: ["indicatorId"], where: { ward: ww, period }, _avg: { value: true } }) : [];
  return defs.map((d) => {
    const v = avgs.find((a) => a.indicatorId === d.id)?._avg.value ?? null;
    return { key: d.key, name: d.name, icon: d.icon, unit: d.unit, weight: d.weight, value: round1(v), score: v == null ? null : Math.round(normalize(v, d)) };
  });
}

const WARD_SELECT = { id: true, number: true, name: true, localBody: { select: { name: true, type: true, district: { select: { name: true } } } } } as const;

/** Wards ranked by score for the period (lowest first = most in need), with this month's complaint figures. */
export async function wardPerformance(ww: Prisma.WardWhereInput, month: Date, asOf: Date | null, limit = 5, order: "asc" | "desc" = "asc") {
  if (!asOf) return [];
  const { start, end } = monthWindow(month);
  const prevAsOf = addMonths(asOf, -1);
  const snaps = await prisma.scoreSnapshot.findMany({
    where: { ward: ww, period: asOf, score: { not: null } }, orderBy: { score: order }, take: limit,
    select: { wardId: true, score: true, ward: { select: WARD_SELECT } },
  });
  const ids = snaps.map((s) => s.wardId);
  if (!ids.length) return [];
  const [prev, rep, res, open] = await Promise.all([
    prisma.scoreSnapshot.findMany({ where: { wardId: { in: ids }, period: prevAsOf }, select: { wardId: true, score: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, resolvedAt: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, status: { in: OPEN } }, _count: { _all: true } }),
  ]);
  const cnt = (rows: Array<{ wardId: string; _count: { _all: number } }>) => new Map(rows.map((r) => [r.wardId, r._count._all]));
  const repM = cnt(rep), resM = cnt(res), openM = cnt(open), prevM = new Map(prev.map((p) => [p.wardId, p.score]));
  return snaps.map((s) => {
    const reported = repM.get(s.wardId) ?? 0, resolved = resM.get(s.wardId) ?? 0;
    return {
      id: s.wardId, number: s.ward.number, name: s.ward.name, localBody: s.ward.localBody.name, localBodyType: s.ward.localBody.type, district: s.ward.localBody.district.name,
      score: round1(s.score), change: pointChange(s.score, prevM.get(s.wardId) ?? null), band: scoreBand(s.score),
      reported, resolved, rate: resolutionRate(resolved, reported), open: openM.get(s.wardId) ?? 0,
    };
  });
}

export async function categoryDistribution(ww: Prisma.WardWhereInput, start: Date, end: Date) {
  const [rows, cats] = await Promise.all([
    prisma.complaint.groupBy({ by: ["categoryId"], where: { ward: ww, createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.category.findMany({ select: { id: true, name: true, color: true, slug: true } }),
  ]);
  const total = rows.reduce((s, r) => s + r._count._all, 0);
  const items = rows.map((r) => { const c = cats.find((x) => x.id === r.categoryId); return { id: r.categoryId, name: c?.name ?? "Other", slug: c?.slug ?? "other", color: c?.color ?? "#8a96ad", count: r._count._all }; }).sort((a, b) => b.count - a.count);
  const top = items.slice(0, 4);
  const rest = items.slice(4).reduce((s, r) => s + r.count, 0);
  const display = rest > 0 ? [...top, { id: "others", name: "Others", slug: "other", color: "#8a96ad", count: rest }] : top;
  return { total, items: display.map((d) => ({ ...d, pct: total ? Math.round((d.count / total) * 100) : 0 })), all: items };
}

export type DistrictPoint = { id: string; name: string; lgdCode: string | null; latitude: number | null; longitude: number | null; score: number | null; band: string; wards: number; localBodies: number; reported: number };

/** One row per district in view: real LGD structure counts plus score and complaints for the period. */
export async function districtSummary(actor: Actor | null, f: GeoFilter, asOf: Date | null, start: Date, end: Date): Promise<DistrictPoint[]> {
  const cond = filterSql(actor, f);
  const [districts, structure, scores, complaints] = await Promise.all([
    prisma.district.findMany({ where: { AND: [actor ? districtScopeWhere(actor) : {}, f.stateId ? { stateId: f.stateId } : {}, f.districtId ? { id: f.districtId } : {}] }, orderBy: { name: "asc" }, select: { id: true, name: true, lgdCode: true, latitude: true, longitude: true } }),
    prisma.$queryRaw<Array<{ id: string; wards: number; lbs: number }>>`SELECT lb."districtId" AS id, count(*)::int AS wards, count(DISTINCT lb."id")::int AS lbs FROM "Ward" w JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "District" d ON d."id" = lb."districtId" WHERE ${cond} GROUP BY 1`,
    asOf ? prisma.$queryRaw<Array<{ id: string; s: number }>>`SELECT lb."districtId" AS id, avg(x."score")::float AS s FROM "ScoreSnapshot" x ${JOINS} WHERE ${cond} AND x."period" = ${asOf} AND x."score" IS NOT NULL GROUP BY 1` : Promise.resolve([]),
    prisma.$queryRaw<Array<{ id: string; c: number }>>`SELECT lb."districtId" AS id, count(*)::int AS c FROM "Complaint" x ${JOINS} WHERE ${cond} AND x."createdAt" >= ${start} AND x."createdAt" < ${end} GROUP BY 1`,
  ]);
  const st = new Map(structure.map((r) => [r.id, r])), sc = new Map(scores.map((r) => [r.id, r.s])), cm = new Map(complaints.map((r) => [r.id, r.c]));
  return districts.filter((d) => st.has(d.id)).map((d) => {
    const score = round1(sc.get(d.id) ?? null);
    return { ...d, score, band: scoreBand(score), wards: st.get(d.id)?.wards ?? 0, localBodies: st.get(d.id)?.lbs ?? 0, reported: cm.get(d.id) ?? 0 };
  });
}

export async function getDashboard(actor: Actor | null, f: GeoFilter, month: Date, opts: { trendMonths?: number; publicView?: boolean; performanceLimit?: number } = {}) {
  const ww = wardWhere(actor, f);
  const cw: Prisma.ComplaintWhereInput = { ward: ww };
  const { start, end, prevStart, prevEnd } = monthWindow(month);
  const asOf = await latestScorePeriod(ww, start);
  const prevAsOf = asOf ? addMonths(asOf, -1) : null;

  const [wardsNow, wardsPrev, reported, reportedPrev, resolved, resolvedPrev, score, scorePrev, newCount] = await Promise.all([
    prisma.ward.count({ where: { AND: [ww, { createdAt: { lt: end } }] } }),
    prisma.ward.count({ where: { AND: [ww, { createdAt: { lt: prevEnd } }] } }),
    prisma.complaint.count({ where: { ...cw, createdAt: { gte: start, lt: end } } }),
    prisma.complaint.count({ where: { ...cw, createdAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.complaint.count({ where: { ...cw, resolvedAt: { gte: start, lt: end } } }),
    prisma.complaint.count({ where: { ...cw, resolvedAt: { gte: prevStart, lt: prevEnd } } }),
    avgScore(ww, asOf),
    avgScore(ww, prevAsOf),
    prisma.complaint.count({ where: { ...cw, status: "SUBMITTED" } }),
  ]);
  const rate = resolutionRate(resolved, reported);
  const ratePrev = resolutionRate(resolvedPrev, reportedPrev);

  const [indicators, trends, performance, distribution, projects, insights, waterRisk, districts] = await Promise.all([
    indicatorAverages(ww, asOf),
    trendSeries(actor, f, start, opts.trendMonths ?? 12),
    wardPerformance(ww, start, asOf, opts.performanceLimit ?? 5),
    categoryDistribution(ww, start, end),
    prisma.project.findMany({
      where: { ward: ww, archivedAt: null, ...(opts.publicView ? { isPublic: true } : {}) }, orderBy: [{ updatedAt: "desc" }], take: 3,
      include: { ward: { select: { number: true, localBody: { select: { name: true } } } }, category: { select: { slug: true, color: true, name: true } } },
    }),
    prisma.insight.findMany({
      where: { ward: ww, status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: [{ severity: "desc" }, { generatedAt: "desc" }], take: 6,
      include: { ward: { select: { number: true, localBody: { select: { name: true } } } }, category: { select: { name: true, slug: true } } },
    }),
    prisma.insight.findMany({ where: { ward: ww, ruleKey: "WATER_SUPPLY_RISK", status: { in: ["OPEN", "ACKNOWLEDGED"] } }, select: { wardId: true }, distinct: ["wardId"] }),
    districtSummary(actor, f, asOf, start, end),
  ]);

  return {
    month: monthKey(start),
    monthLabel: monthLabel(start, "long"),
    scoreAsOf: asOf ? monthLabel(asOf, "long") : null,
    kpis: {
      totalWards: wardsNow, totalWardsChange: percentChange(wardsNow, wardsPrev),
      reported, reportedChange: percentChange(reported, reportedPrev),
      resolved, resolutionRate: rate, resolutionRateChange: pointChange(rate, ratePrev),
      devScore: score, devScoreChange: pointChange(score, scorePrev),
      newComplaints: newCount,
    },
    indicators, trends, performance, distribution, projects, insights,
    waterRiskWards: waterRisk.length,
    districts,
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Side-by-side comparison for Ward Analytics (at most 4 wards, all checked against scope). */
export async function compareWards(actor: Actor, wardIds: string[], endMonth: Date, months: number) {
  const wards = await prisma.ward.findMany({ where: { AND: [{ id: { in: wardIds.slice(0, 4) } }, wardScopeWhere(actor)] }, select: { id: true, number: true, localBody: { select: { name: true, district: { select: { name: true } } } } } });
  const ms = lastNMonths(endMonth, months);
  const from = ms[0];
  const to = addMonths(ms[ms.length - 1], 1);
  const ids = wards.map((w) => w.id);
  if (!ids.length) return { wards: [], months: ms.map((m) => ({ key: monthKey(m), label: monthLabel(m) })) };
  const now = new Date();
  const [snaps, reported, resolved, open, overdue, avgHours, catRep, catRes, cats] = await Promise.all([
    prisma.scoreSnapshot.findMany({ where: { wardId: { in: ids }, period: { gte: from, lt: to } }, orderBy: { period: "asc" } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, resolvedAt: { gte: from, lt: to } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, status: { in: OPEN } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId"], where: { wardId: { in: ids }, status: { in: OPEN }, dueAt: { lt: now } }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ wardId: string; h: number }>>`SELECT "wardId", avg(extract(epoch FROM ("resolvedAt" - "createdAt")) / 3600)::float AS h FROM "Complaint" WHERE "wardId" = ANY(${ids}::text[]) AND "resolvedAt" >= ${from} AND "resolvedAt" < ${to} GROUP BY 1`,
    prisma.complaint.groupBy({ by: ["wardId", "categoryId"], where: { wardId: { in: ids }, createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["wardId", "categoryId"], where: { wardId: { in: ids }, createdAt: { gte: from, lt: to }, status: { in: ["RESOLVED", "CLOSED"] } }, _count: { _all: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);
  const defs = await activeIndicatorDefs();
  const get = (rows: Array<{ wardId: string; _count: { _all: number } }>, id: string) => rows.find((r) => r.wardId === id)?._count._all ?? 0;
  return {
    months: ms.map((m) => ({ key: monthKey(m), label: monthLabel(m) })),
    wards: wards.map((w) => {
      const series = ms.map((m) => snaps.find((s) => s.wardId === w.id && monthKey(s.period) === monthKey(m))?.score ?? null);
      const latest = [...snaps].reverse().find((s) => s.wardId === w.id);
      const breakdown = ((latest?.breakdown ?? []) as unknown as Contribution[]).map((c) => ({ ...c, name: defs.find((d) => d.key === c.key)?.name ?? c.key }));
      const catRows = catRep.filter((r) => r.wardId === w.id).map((r) => {
        const done = catRes.find((x) => x.wardId === w.id && x.categoryId === r.categoryId)?._count._all ?? 0;
        return { category: cats.find((c) => c.id === r.categoryId)?.name ?? "Other", reported: r._count._all, resolved: done, rate: resolutionRate(done, r._count._all) };
      }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
      return {
        id: w.id, label: `Ward ${w.number}, ${w.localBody.name}`, district: w.localBody.district.name,
        series, latestScore: round1(latest?.score ?? null), latestPeriod: latest ? monthLabel(latest.period, "long") : null,
        coverage: latest?.coverage ?? null, breakdown,
        weakIndicators: breakdown.filter((b) => b.normalized != null && b.normalized < 75).map((b) => b.name),
        reported: get(reported, w.id), resolved: get(resolved, w.id), rate: resolutionRate(get(resolved, w.id), get(reported, w.id)),
        open: get(open, w.id), overdue: get(overdue, w.id),
        avgResolutionHours: round1(avgHours.find((a) => a.wardId === w.id)?.h ?? null),
        categories: catRows,
      };
    }),
  };
}
