import { prisma } from "../db";
import { assertDistrictOrSuper, assertSuperAdmin, type Actor } from "../authz";
import { notFound } from "../errors";
import { audit } from "../audit";
import type { z } from "zod";
import type { departmentSchema, staffSchema, categorySchema } from "../validation";

export async function listOrg() {
  const [departments, staff, categories] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { staff: true, complaints: true } } } }),
    prisma.staffMember.findMany({ orderBy: [{ department: { name: "asc" } }, { name: "asc" }], include: { department: { select: { name: true } }, _count: { select: { complaints: true } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { department: { select: { name: true } }, _count: { select: { complaints: true } } } }),
  ]);
  return { departments, staff, categories };
}

export async function createDepartment(actor: Actor, input: z.infer<typeof departmentSchema>, ip?: string) {
  assertDistrictOrSuper(actor);
  const d = await prisma.department.create({ data: input });
  await audit({ actorId: actor.id, action: "department.create", entityType: "Department", entityId: d.id, summary: d.name, after: input, ipAddress: ip });
  return d;
}

export async function setDepartmentActive(actor: Actor, id: string, isActive: boolean, ip?: string) {
  assertDistrictOrSuper(actor);
  const d = await prisma.department.update({ where: { id }, data: { isActive } });
  await audit({ actorId: actor.id, action: isActive ? "department.activate" : "department.deactivate", entityType: "Department", entityId: id, summary: d.name, ipAddress: ip });
  return d;
}

export async function createStaff(actor: Actor, input: z.infer<typeof staffSchema>, ip?: string) {
  if (!actor.isAdmin) throw notFound();
  const s = await prisma.staffMember.create({ data: input });
  await audit({ actorId: actor.id, action: "staff.create", entityType: "StaffMember", entityId: s.id, summary: `${s.name} (${s.designation})`, ipAddress: ip });
  return s;
}

export async function setStaffActive(actor: Actor, id: string, isActive: boolean, ip?: string) {
  if (!actor.isAdmin) throw notFound();
  const s = await prisma.staffMember.update({ where: { id }, data: { isActive } });
  await audit({ actorId: actor.id, action: isActive ? "staff.activate" : "staff.deactivate", entityType: "StaffMember", entityId: id, summary: s.name, ipAddress: ip });
  return s;
}

export async function upsertCategory(actor: Actor, id: string | null, input: z.infer<typeof categorySchema>, ip?: string) {
  assertSuperAdmin(actor);
  const before = id ? await prisma.category.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound("Category");
  const data = { ...input, departmentId: input.departmentId ?? null };
  const c = id
    ? await prisma.category.update({ where: { id }, data })
    : await prisma.category.create({ data: { ...data, sortOrder: await prisma.category.count() } });
  await audit({ actorId: actor.id, action: id ? "category.update" : "category.create", entityType: "Category", entityId: c.id, summary: c.name, before, after: input, ipAddress: ip });
  return c;
}
