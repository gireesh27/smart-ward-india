import { randomBytes } from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "../db";
import { auth, suppressVerificationEmail } from "../auth";
import { assertDistrictOrSuper, canAssignRole, localBodyScopeWhere, wardScopeWhere, type Actor } from "../authz";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { audit } from "../audit";
import type { z } from "zod";
import type { userCreateSchema, userUpdateSchema } from "../validation";

type ScopeType = "NONE" | "WARD" | "LOCAL_BODY" | "DISTRICT" | "STATE";

/** Users an actor may manage: super admins see everyone; district admins see people tied to their wards. */
function manageableWhere(actor: Actor): Prisma.UserWhereInput {
  if (actor.role === "SUPER_ADMIN") return {};
  return {
    role: { in: ["CITIZEN", "WARD_ADMIN"] },
    OR: [
      { ward: wardScopeWhere(actor) },
      { scopes: { some: { ward: wardScopeWhere(actor) } } },
      { scopes: { some: { localBody: localBodyScopeWhere(actor) } } },
    ],
  };
}

const USER_SORTS: Record<string, Prisma.UserOrderByWithRelationInput[]> = {
  "created.desc": [{ createdAt: "desc" }], "created.asc": [{ createdAt: "asc" }], "name.asc": [{ name: "asc" }], "name.desc": [{ name: "desc" }],
  "role.asc": [{ role: "asc" }, { name: "asc" }], "role.desc": [{ role: "desc" }, { name: "asc" }], "status.asc": [{ isActive: "asc" }, { name: "asc" }], "status.desc": [{ isActive: "desc" }, { name: "asc" }],
};

export async function listUsers(actor: Actor, q: { q?: string; role?: string; page?: number; sort?: string }) {
  assertDistrictOrSuper(actor);
  const and: Prisma.UserWhereInput[] = [manageableWhere(actor)];
  if (q.q) and.push({ OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] });
  if (q.role) and.push({ role: q.role as Role });
  const page = q.page ?? 1;
  const where = { AND: and };
  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: USER_SORTS[q.sort ?? "created.desc"] ?? USER_SORTS["created.desc"], skip: (page - 1) * 25, take: 25,
      select: {
        id: true, name: true, email: true, role: true, isActive: true, emailVerified: true, createdAt: true,
        ward: { select: { number: true, localBody: { select: { name: true } } } },
        scopes: { select: { ward: { select: { number: true, localBody: { select: { name: true } } } }, localBody: { select: { name: true } }, district: { select: { name: true } }, state: { select: { name: true } } } },
      },
    }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 25)) };
}

async function validateScopes(actor: Actor, role: Role, scopeType: ScopeType, ids: string[]) {
  if (role === "CITIZEN" || role === "SUPER_ADMIN") return [];
  if (scopeType === "NONE" || ids.length === 0) throw unprocessable("SCOPE_REQUIRED", "Administrators need at least one geographic assignment.");
  if (role === "WARD_ADMIN" && !["WARD", "LOCAL_BODY"].includes(scopeType)) throw unprocessable("INVALID_SCOPE", "Ward administrators can be assigned wards or a local body.");
  if (role === "DISTRICT_ADMIN" && !["DISTRICT", "STATE"].includes(scopeType)) throw unprocessable("INVALID_SCOPE", "District administrators are assigned districts or a state.");
  if (actor.role !== "SUPER_ADMIN") {
    // A district admin can only delegate wards or local bodies that are inside their own scope.
    if (scopeType !== "WARD" && scopeType !== "LOCAL_BODY") throw forbidden("Only a super administrator can assign district or state scopes.");
    const unique = [...new Set(ids)];
    const inside = scopeType === "WARD"
      ? await prisma.ward.count({ where: { AND: [{ id: { in: unique } }, wardScopeWhere(actor)] } })
      : await prisma.localBody.count({ where: { AND: [{ id: { in: unique } }, localBodyScopeWhere(actor)] } });
    if (inside !== unique.length || unique.length === 0) throw forbidden("You can only assign areas within your own scope.");
  }
  const key = ({ WARD: "wardId", LOCAL_BODY: "localBodyId", DISTRICT: "districtId", STATE: "stateId" } as const)[scopeType as Exclude<ScopeType, "NONE">];
  return ids.map((id) => ({ [key]: id }));
}

/**
 * Create a privileged or citizen account. The new user receives a password-reset
 * email to choose their own password; no default credentials ever exist.
 */
export async function createUser(actor: Actor, input: z.infer<typeof userCreateSchema>, ip?: string) {
  assertDistrictOrSuper(actor);
  if (!canAssignRole(actor, input.role)) throw forbidden("You cannot create accounts with this role.");
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("An account with this email already exists.");
  const scopes = await validateScopes(actor, input.role, input.scopeType, input.scopeIds);

  suppressVerificationEmail(input.email);
  await auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: randomBytes(24).toString("base64url") } });
  const user = await prisma.user.update({
    where: { email: input.email },
    data: { role: input.role, emailVerified: true, scopes: { create: scopes } },
    select: { id: true, email: true },
  });
  await audit({ actorId: actor.id, action: "user.create", entityType: "User", entityId: user.id, summary: `${input.email} as ${input.role}`, after: { role: input.role, scopeType: input.scopeType, scopeIds: input.scopeIds }, ipAddress: ip });
  await auth.api.forgetPassword({ body: { email: input.email, redirectTo: "/reset-password?welcome=1" } });
  return user;
}

export async function updateUser(actor: Actor, id: string, input: z.infer<typeof userUpdateSchema>, ip?: string) {
  assertDistrictOrSuper(actor);
  const target = await prisma.user.findFirst({ where: { AND: [{ id }, manageableWhere(actor)] }, include: { scopes: true } });
  if (!target) throw notFound("User");
  if (target.id === actor.id && (input.role || input.isActive === false)) throw forbidden("You cannot change your own role or deactivate yourself.");
  if (!canAssignRole(actor, target.role)) throw forbidden("You cannot manage this account.");
  const role = input.role ?? target.role;
  if (input.role && !canAssignRole(actor, input.role)) throw forbidden("You cannot assign this role.");

  const data: Prisma.UserUpdateInput = {};
  if (input.role) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  const replaceScopes = input.scopeType !== undefined || (input.role && input.role !== target.role);
  const scopes = replaceScopes ? await validateScopes(actor, role, input.scopeType ?? "NONE", input.scopeIds ?? []) : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });
    if (scopes) {
      await tx.adminScope.deleteMany({ where: { userId: id } });
      if (scopes.length) await tx.adminScope.createMany({ data: scopes.map((s) => ({ ...s, userId: id })) });
    }
    // Revoke sessions on deactivation or role change so new permissions apply immediately.
    if (input.isActive === false || (input.role && input.role !== target.role)) await tx.session.deleteMany({ where: { userId: id } });
    await audit({ actorId: actor.id, action: "user.update", entityType: "User", entityId: id, summary: target.email,
      before: { role: target.role, isActive: target.isActive, scopes: target.scopes.length }, after: { ...input }, ipAddress: ip }, tx);
  });
  return { id };
}
