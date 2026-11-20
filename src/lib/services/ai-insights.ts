import { Prisma, type ComplaintStatus } from "@prisma/client";
import { prisma } from "../db";
import { canAccessDistrict, wardScopeSql, type Actor } from "../authz";
import { forbidden } from "../errors";
import { audit } from "../audit";
import { AI_SYSTEM_PROMPT, buildAiPrompt, parseAiInsights, type AiArea, type AiContext } from "../domain/ai";
import { OPEN_STATUSES } from "../domain/status";
import { monthLabel, monthStart } from "../domain/period";
import { complete, aiStatus } from "../ai/provider";
import { indicatorAverages, latestScorePeriod, wardWhere } from "./analytics";

const OPEN = [...OPEN_STATUSES] as ComplaintStatus[];
const DAY = 86_400_000;

/**
 * Aggregate, non-personal context for the model: real LGD structure counts plus complaint,
 * score, alert and project statistics. For a district, areas are its urban local bodies and
 * rural mandals; state-wide, areas are districts.
 */
export async function buildAiContext(actor: Actor, districtId?: string): Promise<AiContext> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * DAY), d60 = new Date(now.getTime() - 60 * DAY);
  const ww = wardWhere(actor, { districtId });
  const district = districtId ? await prisma.district.findUnique({ where: { id: districtId }, select: { name: true } }) : null;
  const scope = district ? `${district.name} district` : "Andhra Pradesh";

  const geo = [Prisma.sql`w."isActive"`, wardScopeSql(actor), ...(districtId ? [Prisma.sql`lb."districtId" = ${districtId}`] : [])];
  const cond = Prisma.join(geo, " AND ");
  const areaExpr = districtId
    ? Prisma.sql`CASE WHEN lb."type" = 'GRAM_PANCHAYAT' THEN COALESCE(sd."name", lb."name") || ' mandal' ELSE lb."name" END`
    : Prisma.sql`d."name"`;
  const kindExpr = districtId ? Prisma.sql`CASE WHEN lb."type" = 'GRAM_PANCHAYAT' THEN 'mandal' ELSE 'urban' END` : Prisma.sql`'district'`;
  const asOf = await latestScorePeriod(ww, monthStart(now));

  const [rows, scoreRows, wardRows, catRows, structure, villages, alerts, projects, indicators] = await Promise.all([
    prisma.$queryRaw<Array<{ area: string; kind: string; c30: number; p30: number; open: number; overdue: number; res30: number; top: string[] }>>`
      SELECT ${areaExpr} AS area, ${kindExpr} AS kind,
        count(*) FILTER (WHERE c."createdAt" >= ${d30})::int AS c30,
        count(*) FILTER (WHERE c."createdAt" >= ${d60} AND c."createdAt" < ${d30})::int AS p30,
        count(*) FILTER (WHERE c."status" = ANY(${OPEN}::"ComplaintStatus"[]))::int AS open,
        count(*) FILTER (WHERE c."status" = ANY(${OPEN}::"ComplaintStatus"[]) AND c."dueAt" < ${now})::int AS overdue,
        count(*) FILTER (WHERE c."resolvedAt" >= ${d30})::int AS res30,
        (array_agg(cat."name" ORDER BY c."createdAt" DESC))[1:40] AS top
      FROM "Complaint" c JOIN "Ward" w ON w."id" = c."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId"
      JOIN "District" d ON d."id" = lb."districtId" LEFT JOIN "SubDistrict" sd ON sd."id" = lb."subDistrictId" JOIN "Category" cat ON cat."id" = c."categoryId"
      WHERE ${cond} AND c."createdAt" >= ${new Date(now.getTime() - 120 * DAY)}
      GROUP BY 1, 2 ORDER BY c30 DESC LIMIT 25`,
    asOf ? prisma.$queryRaw<Array<{ area: string; s: number }>>`
      SELECT ${areaExpr} AS area, avg(x."score")::float AS s FROM "ScoreSnapshot" x JOIN "Ward" w ON w."id" = x."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId"
      JOIN "District" d ON d."id" = lb."districtId" LEFT JOIN "SubDistrict" sd ON sd."id" = lb."subDistrictId"
      WHERE ${cond} AND x."period" = ${asOf} AND x."score" IS NOT NULL GROUP BY 1` : Promise.resolve([]),
    prisma.$queryRaw<Array<{ area: string; n: number }>>`
      SELECT ${areaExpr} AS area, count(*)::int AS n FROM "Ward" w JOIN "LocalBody" lb ON lb."id" = w."localBodyId"
      JOIN "District" d ON d."id" = lb."districtId" LEFT JOIN "SubDistrict" sd ON sd."id" = lb."subDistrictId" WHERE ${cond} GROUP BY 1`,
    prisma.$queryRaw<Array<{ name: string; l30: number; p30: number; open: number; overdue: number }>>`
      SELECT cat."name" AS name, count(*) FILTER (WHERE c."createdAt" >= ${d30})::int AS l30, count(*) FILTER (WHERE c."createdAt" >= ${d60} AND c."createdAt" < ${d30})::int AS p30,
        count(*) FILTER (WHERE c."status" = ANY(${OPEN}::"ComplaintStatus"[]))::int AS open, count(*) FILTER (WHERE c."status" = ANY(${OPEN}::"ComplaintStatus"[]) AND c."dueAt" < ${now})::int AS overdue
      FROM "Complaint" c JOIN "Category" cat ON cat."id" = c."categoryId" JOIN "Ward" w ON w."id" = c."wardId" JOIN "LocalBody" lb ON lb."id" = w."localBodyId" JOIN "District" d ON d."id" = lb."districtId"
      WHERE ${cond} AND c."createdAt" >= ${new Date(now.getTime() - 120 * DAY)} GROUP BY 1 ORDER BY l30 DESC`,
    prisma.localBody.groupBy({ by: ["type"], where: { isActive: true, ...(districtId ? { districtId } : {}), wards: { some: ww } }, _count: { _all: true } }),
    Promise.all([
      prisma.village.count({ where: districtId ? { districtId } : {} }),
      prisma.village.count({ where: { ...(districtId ? { districtId } : {}), localBodyId: null } }),
      prisma.subDistrict.count({ where: districtId ? { districtId } : {} }),
      districtId ? Promise.resolve(1) : prisma.district.count(),
    ]),
    prisma.insight.findMany({ where: { ward: ww, status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: [{ severity: "desc" }, { generatedAt: "desc" }], take: 15, select: { title: true, severity: true, summary: true, ward: { select: { number: true, localBody: { select: { name: true } } } } } }),
    Promise.all([
      prisma.project.count({ where: { ward: ww, archivedAt: null, status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { ward: ww, archivedAt: null, status: "IN_PROGRESS", targetDate: { lt: now } } }),
      prisma.project.count({ where: { ward: ww, status: "COMPLETED" } }),
    ]),
    indicatorAverages(ww, asOf),
  ]);
  const scoreBy = new Map(scoreRows.map((r) => [r.area, r.s]));
  const wardsBy = new Map(wardRows.map((r) => [r.area, r.n]));
  const tally = (names: string[]) => Object.entries(names.reduce<Record<string, number>>((a, n) => ((a[n] = (a[n] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`);
  const areas: AiArea[] = rows.map((r) => ({
    name: r.area, kind: r.kind as AiArea["kind"], wards: wardsBy.get(r.area) ?? 0,
    complaints30: r.c30, complaintsPrev30: r.p30, open: r.open, overdue: r.overdue,
    resolutionRate: r.c30 ? Math.min(100, Math.round((r.res30 / r.c30) * 100)) : null,
    score: scoreBy.has(r.area) ? Math.round(scoreBy.get(r.area)! * 10) / 10 : null,
    topCategories: tally(r.top ?? []),
  }));
  const gp = structure.find((s) => s.type === "GRAM_PANCHAYAT")?._count._all ?? 0;
  return {
    scope,
    generatedFor: monthLabel(monthStart(now), "long"),
    structure: { districts: districtId ? undefined : villages[3], mandals: villages[2], gramPanchayats: gp, urbanBodies: structure.reduce((s, x) => s + (x.type === "GRAM_PANCHAYAT" ? 0 : x._count._all), 0), wards: [...wardsBy.values()].reduce((a, b) => a + b, 0), villages: villages[0], villagesWithoutPanchayat: villages[1] },
    areas,
    categories: catRows.map((c) => ({ name: c.name, last30: c.l30, prev30: c.p30, open: c.open, overdue: c.overdue })),
    indicators: indicators.map((i) => ({ name: i.name, score: i.score })),
    ruleAlerts: alerts.map((a) => ({ title: a.title, severity: a.severity, summary: a.summary, area: a.ward ? `Ward ${a.ward.number}, ${a.ward.localBody.name}` : scope })),
    projects: { active: projects[0], delayed: projects[1], completed: projects[2] },
  };
}

export async function generateAiReport(actor: Actor, districtId?: string, ip?: string) {
  if (districtId ? !(await canAccessDistrict(actor, districtId)) : !actor.scope.all) {
    throw forbidden(districtId ? "You can only analyse districts in your scope." : "Choose a district — state-wide analysis is for super administrators.");
  }
  const ctx = await buildAiContext(actor, districtId);
  const result = await complete({ system: AI_SYSTEM_PROMPT, user: buildAiPrompt(ctx), json: true });
  const parsed = parseAiInsights(result.text, [ctx.scope, ...ctx.areas.map((a) => a.name), ...ctx.ruleAlerts.map((a) => a.area)], ctx.categories.map((c) => c.name));
  const report = await prisma.aiReport.create({
    data: {
      districtId: districtId ?? null, provider: result.provider, model: result.model, createdById: actor.id,
      status: parsed.error ? "FAILED" : parsed.dropped ? "PARTIAL" : "OK",
      insights: parsed.insights as unknown as Prisma.InputJsonValue,
      context: ctx as unknown as Prisma.InputJsonValue,
      error: parsed.error ?? (parsed.dropped ? `${parsed.dropped} item(s) dropped: unknown area or missing fields` : null),
    },
  });
  await audit({ actorId: actor.id, action: "ai.report", entityType: "AiReport", entityId: report.id, summary: `${ctx.scope}: ${parsed.insights.length} insights via ${result.provider}/${result.model}`, ipAddress: ip });
  return report;
}

export async function listAiReports(actor: Actor, districtId?: string) {
  if (districtId ? !(await canAccessDistrict(actor, districtId)) : !actor.scope.all) return [];
  return prisma.aiReport.findMany({ where: { districtId: districtId ?? null }, orderBy: { createdAt: "desc" }, take: 5, include: { district: { select: { name: true } }, createdBy: { select: { name: true } } } });
}

export { aiStatus };
