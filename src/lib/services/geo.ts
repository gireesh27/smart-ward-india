import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertSuperAdmin, districtScopeWhere, localBodyScopeWhere, wardScopeWhere, type Actor } from "../authz";
import { unprocessable } from "../errors";
import { audit } from "../audit";
import type { GeoPath } from "../geo-types";
import type { z } from "zod";
import type { geoCreateSchema } from "../validation";

export type { GeoPath };

/*
 * Geography is loaded level by level (State → District → Panchayat/Municipality → Ward):
 * the full Andhra Pradesh hierarchy has 13,451 local bodies and 245,030 wards.
 */
export async function listStates() {
  return prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, lgdCode: true } });
}

export async function listDistricts(stateId: string | undefined, actor: Actor | null) {
  return prisma.district.findMany({
    where: { AND: [stateId ? { stateId } : {}, actor ? districtScopeWhere(actor) : {}] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, nameLocal: true, lgdCode: true, latitude: true, longitude: true },
  });
}

export async function listLocalBodies(opts: { districtId: string; q?: string; actor: Actor | null; limit?: number }) {
  const q = opts.q?.trim();
  const where: Prisma.LocalBodyWhereInput = {
    AND: [
      { districtId: opts.districtId, isActive: true },
      opts.actor ? localBodyScopeWhere(opts.actor) : {},
      q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { subDistrict: { name: { contains: q, mode: "insensitive" } } }, { lgdCode: q }] } : {},
    ],
  };
  const [total, items] = await Promise.all([
    prisma.localBody.count({ where }),
    // Urban bodies sort before Gram Panchayats (enum order), then alphabetically.
    prisma.localBody.findMany({ where, orderBy: [{ type: "asc" }, { name: "asc" }], take: Math.min(opts.limit ?? 2000, 2000), select: { id: true, name: true, type: true, lgdCode: true, subDistrict: { select: { name: true } } } }),
  ]);
  return { total, items: items.map((l) => ({ id: l.id, name: l.name, type: l.type, lgdCode: l.lgdCode, subDistrict: l.subDistrict?.name ?? null })) };
}

export async function listWards(localBodyId: string, actor: Actor | null) {
  return prisma.ward.findMany({
    where: { AND: [{ localBodyId, isActive: true }, actor ? wardScopeWhere(actor) : {}] },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true, nameLocal: true, lgdCode: true },
  });
}

/** Full path (with labels) for a ward, local body or district — used to pre-fill pickers. */
export async function geoPathFor(ref: { wardId?: string | null; localBodyId?: string | null; districtId?: string | null }): Promise<GeoPath> {
  const lbSelect = { id: true, name: true, type: true, subDistrict: { select: { name: true } }, district: { select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true } } } } } as const;
  if (ref.wardId) {
    const w = await prisma.ward.findUnique({ where: { id: ref.wardId }, select: { id: true, number: true, name: true, localBody: { select: lbSelect } } });
    if (w) return { state: w.localBody.district.state, district: { id: w.localBody.district.id, name: w.localBody.district.name, latitude: w.localBody.district.latitude, longitude: w.localBody.district.longitude }, localBody: { id: w.localBody.id, name: w.localBody.name, type: w.localBody.type, subDistrict: w.localBody.subDistrict?.name ?? null }, ward: { id: w.id, number: w.number, name: w.name } };
  }
  if (ref.localBodyId) {
    const l = await prisma.localBody.findUnique({ where: { id: ref.localBodyId }, select: lbSelect });
    if (l) return { state: l.district.state, district: { id: l.district.id, name: l.district.name, latitude: l.district.latitude, longitude: l.district.longitude }, localBody: { id: l.id, name: l.name, type: l.type, subDistrict: l.subDistrict?.name ?? null } };
  }
  if (ref.districtId) {
    const d = await prisma.district.findUnique({ where: { id: ref.districtId }, select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true } } } });
    if (d) return { state: d.state, district: { id: d.id, name: d.name, latitude: d.latitude, longitude: d.longitude } };
  }
  const states = await listStates();
  return states.length === 1 ? { state: { id: states[0].id, name: states[0].name } } : {};
}

/** "Find my Panchayat": search villages (mapped to their Gram Panchayat) and local bodies by name. */
export async function searchPlaces(q: string, limit = 12) {
  const term = q.trim();
  if (term.length < 2) return [];
  const dSel = { select: { id: true, name: true, latitude: true, longitude: true, state: { select: { id: true, name: true } } } } as const;
  const [villages, bodies] = await Promise.all([
    prisma.village.findMany({
      where: { name: { contains: term, mode: "insensitive" }, localBodyId: { not: null } }, take: limit, orderBy: { name: "asc" },
      select: { id: true, name: true, subDistrict: { select: { name: true } }, district: dSel, localBody: { select: { id: true, name: true, type: true } } },
    }),
    prisma.localBody.findMany({
      where: { name: { contains: term, mode: "insensitive" }, isActive: true }, take: Math.ceil(limit / 2), orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, subDistrict: { select: { name: true } }, district: dSel },
    }),
  ]);
  const path = (d: { id: string; name: string; latitude: number | null; longitude: number | null; state: { id: string; name: string } }, lb: { id: string; name: string; type: string }, sub: string | null): GeoPath =>
    ({ state: d.state, district: { id: d.id, name: d.name, latitude: d.latitude, longitude: d.longitude }, localBody: { id: lb.id, name: lb.name, type: lb.type, subDistrict: sub } });
  return [
    ...bodies.map((b) => ({ kind: "localBody" as const, id: b.id, label: b.name, sublabel: [b.subDistrict?.name, b.district.name].filter(Boolean).join(", "), path: path(b.district, b, b.subDistrict?.name ?? null) })),
    ...villages.map((v) => ({ kind: "village" as const, id: v.id, label: v.name, sublabel: `Village in ${v.localBody!.name} GP · ${[v.subDistrict?.name, v.district.name].filter(Boolean).join(", ")}`, path: path(v.district, v.localBody!, v.subDistrict?.name ?? null) })),
  ].slice(0, limit);
}

/** Per-district structure counts plus the LGD conversion report, for Settings → Geography. */
export async function geoSummary() {
  const [districts, lbCounts, wardCounts, villageCounts] = await Promise.all([
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, lgdCode: true, latitude: true, longitude: true, _count: { select: { subDistricts: true } } } }),
    prisma.localBody.groupBy({ by: ["districtId", "type"], where: { isActive: true }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ id: string; n: number }>>`SELECT lb."districtId" AS id, count(*)::int AS n FROM "Ward" w JOIN "LocalBody" lb ON lb."id" = w."localBodyId" WHERE w."isActive" GROUP BY 1`,
    prisma.village.groupBy({ by: ["districtId"], _count: { _all: true } }),
  ]);
  const dir = process.env.LGD_DATA_DIR ?? "data/lgd/andhra-pradesh";
  const reportPath = join(process.cwd(), dir, "report.json");
  const report = existsSync(reportPath) ? (JSON.parse(readFileSync(reportPath, "utf8")) as { generatedAt: string; counts: Record<string, number>; issues: Record<string, unknown> }) : null;
  return {
    report,
    districts: districts.map((d) => ({
      ...d,
      mandals: d._count.subDistricts,
      gramPanchayats: lbCounts.filter((c) => c.districtId === d.id && c.type === "GRAM_PANCHAYAT").reduce((s, c) => s + c._count._all, 0),
      urbanBodies: lbCounts.filter((c) => c.districtId === d.id && c.type !== "GRAM_PANCHAYAT").reduce((s, c) => s + c._count._all, 0),
      wards: wardCounts.find((w) => w.id === d.id)?.n ?? 0,
      villages: villageCounts.find((v) => v.districtId === d.id)?._count._all ?? 0,
    })),
  };
}

export async function wardLabel(wardId: string) {
  const w = await prisma.ward.findUnique({ where: { id: wardId }, select: { number: true, name: true, localBody: { select: { name: true, type: true, subDistrict: { select: { name: true } }, district: { select: { name: true, state: { select: { name: true } } } } } } } });
  return w ? { ...w, label: `Ward ${w.number}, ${w.localBody.name}` } : null;
}

export async function createGeo(actor: Actor, input: z.infer<typeof geoCreateSchema>, ip?: string) {
  assertSuperAdmin(actor);
  let created: { id: string; name: string };
  if (input.level === "district") {
    if (!input.code) throw unprocessable("CODE_REQUIRED", "Districts need a short unique code (use the LGD district code if available).");
    created = await prisma.district.create({ data: { name: input.name, code: input.code.toUpperCase(), stateId: input.parentId, latitude: input.latitude, longitude: input.longitude } });
  } else if (input.level === "localBody") {
    created = await prisma.localBody.create({ data: { name: input.name, type: input.type ?? "GRAM_PANCHAYAT", districtId: input.parentId } });
  } else {
    if (!input.number) throw unprocessable("NUMBER_REQUIRED", "Wards need a number.");
    created = await prisma.ward.create({ data: { name: input.name, number: input.number, localBodyId: input.parentId, latitude: input.latitude, longitude: input.longitude } });
  }
  await audit({ actorId: actor.id, action: `geo.create.${input.level}`, entityType: input.level, entityId: created.id, summary: created.name, after: input, ipAddress: ip });
  return created;
}

export async function setWardActive(actor: Actor, id: string, isActive: boolean, ip?: string) {
  assertSuperAdmin(actor);
  const w = await prisma.ward.update({ where: { id }, data: { isActive } });
  await audit({ actorId: actor.id, action: isActive ? "ward.activate" : "ward.deactivate", entityType: "Ward", entityId: id, summary: `Ward ${w.number}`, ipAddress: ip });
  return { id };
}

/** LGD villages of a mandal (sub-district LGD code), with their Gram Panchayat. Used by the map details panel. */
export async function listVillages(subDistrictLgd: string) {
  const rows = await prisma.village.findMany({
    where: { subDistrict: { lgdCode: subDistrictLgd } }, orderBy: { name: "asc" }, take: 600,
    select: { lgdCode: true, name: true, status: true, localBody: { select: { id: true, name: true } } },
  });
  return rows.map((v) => ({ lgdCode: v.lgdCode, name: v.name, status: v.status, gp: v.localBody }));
}
