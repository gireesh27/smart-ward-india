import { Prisma, type AdminScope, type Role } from "@prisma/client";
import { prisma } from "./db";
import { forbidden, notFound } from "./errors";

/**
 * An administrator's geographic scope, kept as the assignments themselves
 * (never expanded into ward lists): a district admin may cover 15,000+ wards,
 * so every query filters through relations instead of "IN (...)" lists.
 */
export type Scope =
  | { all: true }
  | { all: false; wardIds: string[]; localBodyIds: string[]; districtIds: string[]; stateIds: string[] };

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  wardId: string | null;
  isAdmin: boolean;
  scope: Scope;
};

export const ADMIN_ROLES: Role[] = ["WARD_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"];
export const ROLE_LABEL: Record<Role, string> = {
  CITIZEN: "Citizen",
  WARD_ADMIN: "Ward Administrator",
  DISTRICT_ADMIN: "District Administrator",
  SUPER_ADMIN: "Super Administrator",
};

export const isAdminRole = (role: Role) => ADMIN_ROLES.includes(role);
const EMPTY: Scope = { all: false, wardIds: [], localBodyIds: [], districtIds: [], stateIds: [] };

export async function resolveScope(role: Role, scopes: AdminScope[]): Promise<Scope> {
  if (role === "SUPER_ADMIN") return { all: true };
  if (!isAdminRole(role)) return EMPTY;
  const pick = (k: "wardId" | "localBodyId" | "districtId" | "stateId") => [...new Set(scopes.map((s) => s[k]).filter((v): v is string => !!v))];
  return { all: false, wardIds: pick("wardId"), localBodyIds: pick("localBodyId"), districtIds: pick("districtId"), stateIds: pick("stateId") };
}

type Limited = Extract<Scope, { all: false }>;
const isEmpty = (s: Limited) => !s.wardIds.length && !s.localBodyIds.length && !s.districtIds.length && !s.stateIds.length;

/** Wards an administrator may see. Non-admins: none. */
export function wardScopeWhere(actor: Actor): Prisma.WardWhereInput {
  if (!actor.isAdmin) return { id: { in: [] } };
  const s = actor.scope;
  if (s.all) return {};
  if (isEmpty(s)) return { id: { in: [] } };
  const or: Prisma.WardWhereInput[] = [];
  if (s.wardIds.length) or.push({ id: { in: s.wardIds } });
  if (s.localBodyIds.length) or.push({ localBodyId: { in: s.localBodyIds } });
  if (s.districtIds.length) or.push({ localBody: { districtId: { in: s.districtIds } } });
  if (s.stateIds.length) or.push({ localBody: { district: { stateId: { in: s.stateIds } } } });
  return { OR: or };
}

export function localBodyScopeWhere(actor: Actor): Prisma.LocalBodyWhereInput {
  if (!actor.isAdmin) return { id: { in: [] } };
  const s = actor.scope;
  if (s.all) return {};
  if (isEmpty(s)) return { id: { in: [] } };
  const or: Prisma.LocalBodyWhereInput[] = [];
  if (s.localBodyIds.length) or.push({ id: { in: s.localBodyIds } });
  if (s.districtIds.length) or.push({ districtId: { in: s.districtIds } });
  if (s.stateIds.length) or.push({ district: { stateId: { in: s.stateIds } } });
  if (s.wardIds.length) or.push({ wards: { some: { id: { in: s.wardIds } } } });
  return { OR: or };
}

export function districtScopeWhere(actor: Actor): Prisma.DistrictWhereInput {
  if (!actor.isAdmin) return { id: { in: [] } };
  const s = actor.scope;
  if (s.all) return {};
  if (isEmpty(s)) return { id: { in: [] } };
  const or: Prisma.DistrictWhereInput[] = [];
  if (s.districtIds.length) or.push({ id: { in: s.districtIds } });
  if (s.stateIds.length) or.push({ stateId: { in: s.stateIds } });
  if (s.localBodyIds.length) or.push({ localBodies: { some: { id: { in: s.localBodyIds } } } });
  if (s.wardIds.length) or.push({ localBodies: { some: { wards: { some: { id: { in: s.wardIds } } } } } });
  return { OR: or };
}

/** Which complaints an actor may see: their own (citizen) or those in scope (admin). */
export function complaintScopeWhere(actor: Actor): Prisma.ComplaintWhereInput {
  if (!actor.isAdmin) return { reporterId: actor.id };
  return actor.scope.all ? {} : { ward: wardScopeWhere(actor) };
}

/**
 * SQL equivalent of wardScopeWhere for raw queries. Requires the query to alias
 * "Ward" as w, "LocalBody" as lb and "District" as d.
 */
export function wardScopeSql(actor: Actor | null): Prisma.Sql {
  if (!actor) return Prisma.sql`TRUE`;
  if (!actor.isAdmin) return Prisma.sql`FALSE`;
  const s = actor.scope;
  if (s.all) return Prisma.sql`TRUE`;
  if (isEmpty(s)) return Prisma.sql`FALSE`;
  const parts: Prisma.Sql[] = [];
  if (s.wardIds.length) parts.push(Prisma.sql`w."id" = ANY(${s.wardIds}::text[])`);
  if (s.localBodyIds.length) parts.push(Prisma.sql`w."localBodyId" = ANY(${s.localBodyIds}::text[])`);
  if (s.districtIds.length) parts.push(Prisma.sql`lb."districtId" = ANY(${s.districtIds}::text[])`);
  if (s.stateIds.length) parts.push(Prisma.sql`d."stateId" = ANY(${s.stateIds}::text[])`);
  return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
}

export type WardLocation = { wardId: string; localBodyId: string; districtId: string; stateId: string };

/** Synchronous check when the ward's parents are already loaded. */
export function inScope(actor: Actor, loc: WardLocation): boolean {
  if (!actor.isAdmin) return false;
  const s = actor.scope;
  if (s.all) return true;
  return s.wardIds.includes(loc.wardId) || s.localBodyIds.includes(loc.localBodyId) || s.districtIds.includes(loc.districtId) || s.stateIds.includes(loc.stateId);
}

// Ward → parents never change at runtime except via LGD import; cache lookups briefly.
const locCache = new Map<string, { loc: WardLocation | null; at: number }>();
export async function wardLocation(wardId: string): Promise<WardLocation | null> {
  const hit = locCache.get(wardId);
  if (hit && Date.now() - hit.at < 300_000) return hit.loc;
  const w = await prisma.ward.findUnique({ where: { id: wardId }, select: { id: true, localBodyId: true, localBody: { select: { districtId: true, district: { select: { stateId: true } } } } } });
  const loc = w ? { wardId: w.id, localBodyId: w.localBodyId, districtId: w.localBody.districtId, stateId: w.localBody.district.stateId } : null;
  if (locCache.size > 20_000) locCache.clear();
  locCache.set(wardId, { loc, at: Date.now() });
  return loc;
}

export async function canAccessWard(actor: Actor, wardId: string): Promise<boolean> {
  if (!actor.isAdmin) return false;
  if (actor.scope.all) return true;
  if (actor.scope.wardIds.includes(wardId)) return true;
  const loc = await wardLocation(wardId);
  return !!loc && inScope(actor, loc);
}

export async function canAccessDistrict(actor: Actor, districtId: string): Promise<boolean> {
  if (!actor.isAdmin) return false;
  if (actor.scope.all || actor.scope.districtIds.includes(districtId)) return true;
  return (await prisma.district.count({ where: { AND: [{ id: districtId }, districtScopeWhere(actor)] } })) > 0;
}

export function assertAdmin(actor: Actor) {
  if (!actor.isAdmin) throw forbidden("Administrator access is required.");
}

/** Throws 404 (not 403) so out-of-scope records are indistinguishable from missing ones. */
export async function assertWardAccess(actor: Actor, wardId: string, what = "Record") {
  if (!(await canAccessWard(actor, wardId))) throw notFound(what);
}

/** Only super admins grant district/super roles; district admins manage ward admins and citizens. */
export function canAssignRole(actor: Actor, target: Role): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "DISTRICT_ADMIN") return target === "WARD_ADMIN" || target === "CITIZEN";
  return false;
}

export function canManageUsers(actor: Actor) {
  return actor.role === "SUPER_ADMIN" || actor.role === "DISTRICT_ADMIN";
}

export function assertSuperAdmin(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super administrator can do this.");
}

export function assertDistrictOrSuper(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "DISTRICT_ADMIN") throw forbidden("District or super administrator access is required.");
}
