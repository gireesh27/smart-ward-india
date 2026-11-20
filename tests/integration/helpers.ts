import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { resolveScope, isAdminRole, type Actor } from "@/lib/authz";
import type { Role } from "@prisma/client";

export const hasDb = !!process.env.TEST_DATABASE_URL;

export async function resetDb() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

export async function world() {
  const state = await prisma.state.create({ data: { name: "Test State", code: "TS" } });
  const d1 = await prisma.district.create({ data: { name: "North", code: "N", stateId: state.id } });
  const d2 = await prisma.district.create({ data: { name: "South", code: "S", stateId: state.id } });
  const lb1 = await prisma.localBody.create({ data: { name: "North Municipality", type: "MUNICIPALITY", districtId: d1.id } });
  const lb2 = await prisma.localBody.create({ data: { name: "South Municipality", type: "MUNICIPALITY", districtId: d2.id } });
  const wardA = await prisma.ward.create({ data: { number: 1, name: "A", localBodyId: lb1.id } });
  const wardB = await prisma.ward.create({ data: { number: 1, name: "B", localBodyId: lb2.id } });
  const dept = await prisma.department.create({ data: { name: "Water", code: "WATER" } });
  const cat = await prisma.category.create({ data: { slug: "water", name: "Water", icon: "water", color: "#1b66e3", slaHours: 48, departmentId: dept.id } });
  return { state, d1, d2, lb1, lb2, wardA, wardB, dept, cat };
}

export async function makeActor(role: Role, scope: { wardId?: string; districtId?: string } = {}, wardId?: string): Promise<Actor> {
  const u = await prisma.user.create({ data: { id: randomUUID(), name: `${role} user`, email: `${randomUUID()}@test.local`, emailVerified: true, role, wardId, scopes: scope.wardId || scope.districtId ? { create: [scope] } : undefined }, include: { scopes: true } });
  return { id: u.id, name: u.name, email: u.email, role, wardId: u.wardId, isAdmin: isAdminRole(role), scope: await resolveScope(role, u.scopes) };
}

export async function evidenceFor(actor: Actor) {
  return prisma.attachment.create({ data: { storageKey: `test/${randomUUID()}.png`, fileName: "e.png", mimeType: "image/png", size: 10, purpose: "RESOLUTION", uploaderId: actor.id } });
}

export const code = async (p: Promise<unknown>) =>
  p.then(() => "ok", (e: { status?: number; code?: string }) => (e && e.status ? `${e.status}:${e.code}` : String(e)));
