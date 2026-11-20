import { randomBytes } from "node:crypto";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "../db";
import { assertWardAccess, inScope, wardScopeWhere, type Actor } from "../authz";
import { notFound, unprocessable } from "../errors";
import { audit } from "../audit";
import type { z } from "zod";
import type { projectSchema, milestoneSchema, manualProgressSchema } from "../validation";

type ProjectInput = z.infer<typeof projectSchema>;

export type ProjectFilter = { ward?: string; localBody?: string; district?: string; status?: string; category?: string; q?: string; archived?: boolean; page?: number; sort?: string };
export const PROJECT_SORTS: Record<string, Prisma.ProjectOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: "desc" }], "name.asc": [{ name: "asc" }], "name.desc": [{ name: "desc" }],
  "progress.desc": [{ progress: "desc" }, { updatedAt: "desc" }], "progress.asc": [{ progress: "asc" }, { updatedAt: "desc" }],
  "budget.desc": [{ budget: "desc" }], "budget.asc": [{ budget: "asc" }],
  "target.asc": [{ targetDate: "asc" }], "target.desc": [{ targetDate: "desc" }],
  "status.asc": [{ status: "asc" }, { updatedAt: "desc" }],
};

export async function listProjects(actor: Actor | null, f: ProjectFilter = {}) {
  const and: Prisma.ProjectWhereInput[] = [];
  if (actor?.isAdmin) and.push({ ward: wardScopeWhere(actor) });
  else and.push({ isPublic: true, archivedAt: null });
  if (actor?.isAdmin) and.push(f.archived ? { archivedAt: { not: null } } : { archivedAt: null });
  if (f.ward) and.push({ wardId: f.ward });
  if (f.localBody) and.push({ ward: { localBodyId: f.localBody } });
  if (f.district) and.push({ ward: { localBody: { districtId: f.district } } });
  if (f.status) and.push({ status: f.status as ProjectStatus });
  if (f.category) and.push({ categoryId: f.category });
  if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }] });
  const page = f.page ?? 1;
  const where = { AND: and };
  const [total, items] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: PROJECT_SORTS[f.sort ?? "updated"] ?? PROJECT_SORTS.updated,
      skip: (page - 1) * 20,
      take: 20,
      include: {
        category: { select: { name: true, slug: true, color: true } },
        ward: { select: { id: true, number: true, name: true, localBody: { select: { name: true } } } },
        department: { select: { name: true } },
        _count: { select: { milestones: true } },
      },
    }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
}

export async function getProject(actor: Actor | null, id: string) {
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      category: true,
      ward: { include: { localBody: { include: { district: true } } } },
      department: true,
      milestones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      progressLogs: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, size: true, purpose: true, isPublic: true, createdAt: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!p) throw notFound("Project");
  const admin = !!actor && actor.isAdmin && inScope(actor, { wardId: p.wardId, localBodyId: p.ward.localBodyId, districtId: p.ward.localBody.districtId, stateId: p.ward.localBody.district.stateId });
  if (!admin) {
    if (!p.isPublic || p.archivedAt) throw notFound("Project");
    return { ...p, attachments: p.attachments.filter((a) => a.isPublic), progressLogs: p.progressLogs.map((l) => ({ ...l, actor: { name: "Ward office" } })), createdBy: { name: "Ward office" }, canEdit: false };
  }
  return { ...p, canEdit: true };
}

export function milestoneProgress(ms: Array<{ weight: number; completedAt: Date | null }>): number {
  const total = ms.reduce((s, m) => s + m.weight, 0);
  if (total === 0) return 0;
  return Math.round((ms.filter((m) => m.completedAt).reduce((s, m) => s + m.weight, 0) / total) * 100);
}

export async function createProject(actor: Actor, input: ProjectInput, ip?: string) {
  await assertWardAccess(actor, input.wardId, "Ward");
  const code = `PRJ-${String(new Date().getUTCFullYear()).slice(-2)}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        code, name: input.name, description: input.description, categoryId: input.categoryId, wardId: input.wardId,
        departmentId: input.departmentId, budget: input.budget, expenditure: input.expenditure,
        startDate: input.startDate, targetDate: input.targetDate, status: input.status, progressMode: input.progressMode,
        isPublic: input.isPublic, createdById: actor.id, completedAt: input.status === "COMPLETED" ? new Date() : null,
        progress: input.status === "COMPLETED" ? 100 : 0,
      },
    });
    await tx.projectProgressLog.create({ data: { projectId: created.id, progress: created.progress, source: input.progressMode, actorId: actor.id, note: "Project created" } });
    await audit({ actorId: actor.id, action: "project.create", entityType: "Project", entityId: created.id, summary: `${created.code} ${created.name}`, after: input, ipAddress: ip }, tx);
    return created;
  });
  return { id: p.id, code: p.code };
}

async function loadEditable(actor: Actor, id: string) {
  const p = await prisma.project.findUnique({ where: { id }, include: { milestones: true } });
  if (!p) throw notFound("Project");
  await assertWardAccess(actor, p.wardId, "Project");
  return p;
}

export async function updateProject(actor: Actor, id: string, input: ProjectInput, ip?: string) {
  const before = await loadEditable(actor, id);
  await assertWardAccess(actor, input.wardId, "Ward");
  const completing = input.status === "COMPLETED" && before.status !== "COMPLETED";
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        name: input.name, description: input.description, categoryId: input.categoryId, wardId: input.wardId,
        departmentId: input.departmentId ?? null, budget: input.budget, expenditure: input.expenditure,
        startDate: input.startDate, targetDate: input.targetDate, status: input.status, progressMode: input.progressMode,
        isPublic: input.isPublic, completedAt: input.status === "COMPLETED" ? before.completedAt ?? new Date() : null,
      },
    });
    if (input.progressMode === "MILESTONES" && before.progressMode !== "MILESTONES") {
      const pct = milestoneProgress(before.milestones);
      await tx.project.update({ where: { id }, data: { progress: pct } });
      await tx.projectProgressLog.create({ data: { projectId: id, progress: pct, source: "MILESTONES", actorId: actor.id, note: "Switched to milestone-based progress" } });
    }
    if (completing && input.progressMode === "MANUAL") {
      await tx.project.update({ where: { id }, data: { progress: 100 } });
      await tx.projectProgressLog.create({ data: { projectId: id, progress: 100, source: "MANUAL", actorId: actor.id, note: "Marked completed" } });
    }
    await audit({ actorId: actor.id, action: "project.update", entityType: "Project", entityId: id, summary: `${before.code} updated`,
      before: { name: before.name, status: before.status, budget: before.budget.toString(), expenditure: before.expenditure.toString(), isPublic: before.isPublic },
      after: { name: input.name, status: input.status, budget: input.budget, expenditure: input.expenditure, isPublic: input.isPublic }, ipAddress: ip }, tx);
  });
  return { id };
}

export async function setArchived(actor: Actor, id: string, archived: boolean, ip?: string) {
  const p = await loadEditable(actor, id);
  await prisma.project.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit({ actorId: actor.id, action: archived ? "project.archive" : "project.unarchive", entityType: "Project", entityId: id, summary: p.code, ipAddress: ip });
  return { id, archived };
}

type MilestoneInput = z.infer<typeof milestoneSchema>;
export async function addMilestone(actor: Actor, id: string, input: MilestoneInput) {
  const p = await loadEditable(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.milestone.create({ data: { projectId: id, title: input.title, dueDate: input.dueDate, weight: input.weight, sortOrder: p.milestones.length } });
    if (p.progressMode === "MILESTONES") {
      const all = await tx.milestone.findMany({ where: { projectId: id } });
      const pct = milestoneProgress(all);
      if (pct !== p.progress) {
        await tx.project.update({ where: { id }, data: { progress: pct } });
        await tx.projectProgressLog.create({ data: { projectId: id, progress: pct, source: "MILESTONES", actorId: actor.id, note: `Milestone added: ${input.title}` } });
      }
    }
  });
  return { id };
}

export async function toggleMilestone(actor: Actor, id: string, milestoneId: string, completed: boolean, ip?: string) {
  const p = await loadEditable(actor, id);
  const m = p.milestones.find((x) => x.id === milestoneId);
  if (!m) throw notFound("Milestone");
  await prisma.$transaction(async (tx) => {
    await tx.milestone.update({ where: { id: milestoneId }, data: { completedAt: completed ? new Date() : null } });
    if (p.progressMode === "MILESTONES") {
      const all = await tx.milestone.findMany({ where: { projectId: id } });
      const pct = milestoneProgress(all);
      await tx.project.update({ where: { id }, data: { progress: pct } });
      await tx.projectProgressLog.create({ data: { projectId: id, progress: pct, source: "MILESTONES", actorId: actor.id, note: `${completed ? "Completed" : "Reopened"} milestone: ${m.title}` } });
    }
    await audit({ actorId: actor.id, action: "project.milestone", entityType: "Project", entityId: id, summary: `${p.code}: ${m.title} ${completed ? "completed" : "reopened"}`, ipAddress: ip }, tx);
  });
  return { id };
}

type ManualInput = z.infer<typeof manualProgressSchema>;
export async function recordManualProgress(actor: Actor, id: string, input: ManualInput, ip?: string) {
  const p = await loadEditable(actor, id);
  if (p.progressMode !== "MANUAL") throw unprocessable("MILESTONE_MODE", "Progress for this project is calculated from milestones. Complete milestones instead.");
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id }, data: { progress: input.progress } });
    await tx.projectProgressLog.create({ data: { projectId: id, progress: input.progress, source: "MANUAL", actorId: actor.id, note: input.note } });
    await audit({ actorId: actor.id, action: "project.progress", entityType: "Project", entityId: id, summary: `${p.code}: ${p.progress}% → ${input.progress}%`, before: { progress: p.progress }, after: { progress: input.progress, note: input.note }, ipAddress: ip }, tx);
  });
  return { id };
}

export async function attachProjectFiles(actor: Actor, id: string, attachmentIds: string[], isPublic: boolean) {
  await loadEditable(actor, id);
  const unique = [...new Set(attachmentIds)];
  const res = await prisma.attachment.updateMany({
    where: { id: { in: unique }, uploaderId: actor.id, projectId: null, complaintId: null, purpose: { in: ["PROJECT_PHOTO", "PROJECT_DOCUMENT"] } },
    data: { projectId: id, isPublic },
  });
  if (res.count !== unique.length) throw unprocessable("INVALID_ATTACHMENTS", "Some files could not be attached. Upload them again.");
  return { attached: res.count };
}
