import { randomBytes } from "node:crypto";
import { Prisma, type ComplaintStatus, type Priority } from "@prisma/client";
import { prisma } from "../db";
import { canAccessWard, complaintScopeWhere, inScope, ROLE_LABEL, type Actor } from "../authz";
import { AppError, conflict, notFound, unprocessable } from "../errors";
import {
  checkTransition, computeDueAt, severityToPriority, OPEN_STATUSES, DONE_STATUSES, STATUS_LABELS,
  type ActorKind, type Status,
} from "../domain/status";
import { makeReference } from "../domain/reference";
import { audit } from "../audit";
import { notifyUsers, notifyWardAdmins } from "../notifications";
import type { ComplaintListQuery } from "../validation";
import type { z } from "zod";
import type {
  complaintCreateSchema, statusChangeSchema, assignSchema, prioritySchema, commentSchema, feedbackSchema,
} from "../validation";

const OPEN = [...OPEN_STATUSES] as ComplaintStatus[];
const DONE = [...DONE_STATUSES] as ComplaintStatus[];

// ─── Queries ────────────────────────────────────────────────────────────────

/** Whitelisted orderings for the complaint list and its CSV export (never pass raw column names to the DB). */
export const COMPLAINT_SORTS: Record<string, Prisma.ComplaintOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }], oldest: [{ createdAt: "asc" }],
  priority: [{ priority: "desc" }, { createdAt: "asc" }], due: [{ dueAt: { sort: "asc", nulls: "last" } }], support: [{ supportCount: "desc" }, { createdAt: "desc" }],
  "created.asc": [{ createdAt: "asc" }], "created.desc": [{ createdAt: "desc" }],
  "reference.asc": [{ reference: "asc" }], "reference.desc": [{ reference: "desc" }],
  "title.asc": [{ title: "asc" }], "title.desc": [{ title: "desc" }],
  "ward.asc": [{ ward: { number: "asc" } }, { createdAt: "desc" }], "ward.desc": [{ ward: { number: "desc" } }, { createdAt: "desc" }],
  "category.asc": [{ category: { name: "asc" } }, { createdAt: "desc" }], "category.desc": [{ category: { name: "desc" } }, { createdAt: "desc" }],
  "status.asc": [{ status: "asc" }, { createdAt: "desc" }], "status.desc": [{ status: "desc" }, { createdAt: "desc" }],
  "priority.asc": [{ priority: "asc" }, { createdAt: "asc" }], "priority.desc": [{ priority: "desc" }, { createdAt: "asc" }],
  "support.asc": [{ supportCount: "asc" }, { createdAt: "desc" }], "support.desc": [{ supportCount: "desc" }, { createdAt: "desc" }],
  "due.asc": [{ dueAt: { sort: "asc", nulls: "last" } }], "due.desc": [{ dueAt: { sort: "desc", nulls: "last" } }],
};

export async function listComplaints(actor: Actor, q: ComplaintListQuery) {
  const and: Prisma.ComplaintWhereInput[] = [complaintScopeWhere(actor)];
  if (q.q) {
    and.push({ OR: [
      { reference: { contains: q.q, mode: "insensitive" } },
      { title: { contains: q.q, mode: "insensitive" } },
      { address: { contains: q.q, mode: "insensitive" } },
    ] });
  }
  if (q.status === "open") and.push({ status: { in: OPEN } });
  else if (q.status === "done") and.push({ status: { in: DONE } });
  else if (q.status) and.push({ status: q.status });
  if (q.category) and.push({ categoryId: q.category });
  if (q.ward) and.push({ wardId: q.ward });
  if (q.localBody) and.push({ ward: { localBodyId: q.localBody } });
  if (q.district) and.push({ ward: { localBody: { districtId: q.district } } });
  if (q.priority) and.push({ priority: q.priority });
  if (q.overdue === "1") and.push({ status: { in: OPEN }, dueAt: { lt: new Date() } });

  const orderBy = COMPLAINT_SORTS[q.sort] ?? COMPLAINT_SORTS.newest;

  const where: Prisma.ComplaintWhereInput = { AND: and };
  const [total, items] = await prisma.$transaction([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true, reference: true, title: true, status: true, priority: true, severity: true,
        createdAt: true, dueAt: true, resolvedAt: true, address: true, isPublic: true, supportCount: true,
        category: { select: { id: true, name: true, slug: true, color: true } },
        ward: { select: { id: true, number: true, name: true, localBody: { select: { name: true } } } },
        department: { select: { name: true } },
        _count: { select: { attachments: true } },
      },
    }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function getComplaintForActor(actor: Actor, id: string) {
  const c = await prisma.complaint.findUnique({
    where: { id },
    include: {
      category: true,
      ward: { include: { localBody: { include: { district: { include: { state: true } } } } } },
      reporter: { select: { id: true, name: true, email: true, phone: true } },
      department: true,
      assignedStaff: true,
      duplicateOf: { select: { id: true, reference: true, title: true } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: { select: { id: true, name: true, role: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
        },
      },
      assignments: { orderBy: { createdAt: "desc" }, include: { department: true, staff: true, assignedBy: { select: { name: true } } } },
      feedback: { orderBy: { createdAt: "desc" } },
      attachments: { where: { commentId: null }, orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, size: true, purpose: true, createdAt: true } },
    },
  });
  if (!c) throw notFound("Complaint");
  const isAdmin = actor.isAdmin && inScope(actor, { wardId: c.wardId, localBodyId: c.ward.localBodyId, districtId: c.ward.localBody.districtId, stateId: c.ward.localBody.district.stateId });
  if (!isAdmin && c.reporterId !== actor.id) throw notFound("Complaint");

  if (isAdmin) return { complaint: c, view: "admin" as const };

  // Citizen view: hide internal notes and officials' personal names.
  const label = (role: string, name: string, actorId: string | null) =>
    actorId === actor.id ? "You" : role === "CITIZEN" ? name : ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? "Ward office";
  return {
    complaint: {
      ...c,
      comments: c.comments
        .filter((m) => m.visibility === "PUBLIC")
        .map((m) => ({ ...m, author: { ...m.author, name: label(m.author.role, m.author.name, m.author.id) } })),
      history: c.history.map((h) => ({ ...h, actor: h.actor ? { ...h.actor, name: label(h.actor.role, h.actor.name, h.actor.id) } : null })),
      assignments: c.assignments.map((a) => ({ ...a, assignedBy: { name: "Ward office" } })),
      assignedStaff: c.assignedStaff ? { ...c.assignedStaff, email: null, phone: null } : null,
    },
    view: "citizen" as const,
  };
}

export async function citizenStats(userId: string) {
  const grouped = await prisma.complaint.groupBy({ by: ["status"], where: { reporterId: userId }, _count: { _all: true } });
  const by = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Partial<Record<ComplaintStatus, number>>;
  const sum = (list: ComplaintStatus[]) => list.reduce((s, k) => s + (by[k] ?? 0), 0);
  return { total: grouped.reduce((s, g) => s + g._count._all, 0), open: sum(OPEN), resolved: sum(DONE), awaitingFeedback: by.RESOLVED ?? 0 };
}

// ─── Commands ───────────────────────────────────────────────────────────────

type CreateInput = z.infer<typeof complaintCreateSchema>;

async function claimAttachments(actor: Actor, ids: string[], purpose: "COMPLAINT" | "COMMENT" | "RESOLUTION") {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const atts = await prisma.attachment.findMany({
    where: { id: { in: unique }, uploaderId: actor.id, purpose, complaintId: null, commentId: null, projectId: null },
    select: { id: true },
  });
  if (atts.length !== unique.length) {
    throw unprocessable("INVALID_ATTACHMENTS", "One or more files could not be attached. Upload them again.");
  }
  return unique;
}

export async function createComplaint(actor: Actor, input: CreateInput) {
  const existing = await prisma.complaint.findUnique({
    where: { reporterId_idempotencyKey: { reporterId: actor.id, idempotencyKey: input.idempotencyKey } },
    select: { id: true, reference: true },
  });
  if (existing) return { ...existing, replayed: true };

  const [ward, category] = await Promise.all([
    prisma.ward.findUnique({ where: { id: input.wardId }, select: { id: true, isActive: true, number: true, localBody: { select: { name: true } } } }),
    prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, isActive: true, slaHours: true, name: true, departmentId: true } }),
  ]);
  if (!ward?.isActive) throw unprocessable("INVALID_WARD", "Choose an active ward.");
  if (!category?.isActive) throw unprocessable("INVALID_CATEGORY", "Choose a valid category.");
  const attachmentIds = await claimAttachments(actor, input.attachmentIds, "COMPLAINT");

  const now = new Date();
  const priority = severityToPriority(input.severity);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const c = await tx.complaint.create({
          data: {
            reference: makeReference(now, randomBytes(6)),
            title: input.title,
            description: input.description,
            categoryId: category.id,
            wardId: ward.id,
            reporterId: actor.id,
            address: input.address,
            landmark: input.landmark,
            latitude: input.latitude,
            longitude: input.longitude,
            severity: input.severity,
            priority,
            dueAt: computeDueAt(now, category.slaHours, priority),
            idempotencyKey: input.idempotencyKey,
            isPublic: input.isPublic,
            history: { create: { fromStatus: null, toStatus: "SUBMITTED", actorId: actor.id } },
          },
          select: { id: true, reference: true },
        });
        if (attachmentIds.length) {
          const linked = await tx.attachment.updateMany({ where: { id: { in: attachmentIds }, complaintId: null }, data: { complaintId: c.id } });
          if (linked.count !== attachmentIds.length) throw unprocessable("INVALID_ATTACHMENTS", "Some photos were already used. Upload them again.");
        }
        return c;
      });
      await Promise.all([
        notifyUsers([actor.id], {
          type: "complaint.received",
          title: `Complaint ${created.reference} received`,
          body: `We have received your ${category.name.toLowerCase()} complaint for Ward ${ward.number}, ${ward.localBody.name}. You can track it any time.`,
          link: `/portal/complaints/${created.id}`,
          email: true,
        }),
        notifyWardAdmins(ward.id, {
          type: "complaint.new",
          title: `New ${category.name.toLowerCase()} complaint ${created.reference}`,
          body: input.title,
          link: `/admin/complaints/${created.id}`,
        }),
      ]);
      return { ...created, replayed: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
        if (target.includes("idempotencyKey")) {
          const again = await prisma.complaint.findUnique({
            where: { reporterId_idempotencyKey: { reporterId: actor.id, idempotencyKey: input.idempotencyKey } },
            select: { id: true, reference: true },
          });
          if (again) return { ...again, replayed: true };
        }
        continue; // reference collision: retry with a new reference
      }
      throw err;
    }
  }
  throw new AppError(503, "TRY_AGAIN", "Could not allocate a complaint reference. Try again.");
}

async function loadForCommand(actor: Actor, id: string) {
  const c = await prisma.complaint.findUnique({
    where: { id },
    select: {
      id: true, reference: true, status: true, wardId: true, reporterId: true, departmentId: true,
      closedAt: true, priority: true, createdAt: true, category: { select: { slaHours: true, name: true } },
    },
  });
  if (!c) throw notFound("Complaint");
  let kind: ActorKind;
  if (actor.isAdmin && (await canAccessWard(actor, c.wardId))) kind = "ADMIN";
  else if (c.reporterId === actor.id) kind = "CITIZEN";
  else throw notFound("Complaint");
  return { c, kind };
}

type StatusInput = z.infer<typeof statusChangeSchema>;

export async function changeStatus(actor: Actor, id: string, input: StatusInput, ip?: string) {
  const { c, kind } = await loadForCommand(actor, id);
  const to = input.status as Status;

  let duplicateOfId: string | null = null;
  if (to === "DUPLICATE" && input.duplicateOfReference) {
    const orig = await prisma.complaint.findUnique({ where: { reference: input.duplicateOfReference.trim().toUpperCase() }, select: { id: true, wardId: true, status: true } });
    if (!orig || orig.id === c.id || orig.status === "DUPLICATE" || !(await canAccessWard(actor, orig.wardId))) {
      throw unprocessable("INVALID_DUPLICATE", "Enter the reference of an original complaint within your wards.");
    }
    duplicateOfId = orig.id;
  }

  const evidenceIds = to === "RESOLVED" && kind === "ADMIN" ? await claimAttachments(actor, input.evidenceIds, "RESOLUTION") : [];
  const existingEvidence = to === "RESOLVED" ? await prisma.attachment.count({ where: { complaintId: c.id, purpose: "RESOLUTION" } }) : 0;

  const check = checkTransition(c.status as Status, to, kind, {
    reason: input.reason,
    resolutionNote: input.resolutionNote,
    evidenceCount: existingEvidence + evidenceIds.length,
    duplicateOfId,
    hasAssignment: !!c.departmentId,
    closedAt: c.closedAt,
  });
  if (!check.ok) throw new AppError(check.code === "NOT_PERMITTED" ? 403 : 422, check.code, check.message);

  const now = new Date();
  const data: Prisma.ComplaintUncheckedUpdateManyInput = { status: to };
  if (to === "RESOLVED") { data.resolvedAt = now; data.resolutionNote = input.resolutionNote; }
  if (to === "CLOSED" || to === "REJECTED" || to === "DUPLICATE") data.closedAt = now;
  if (to === "DUPLICATE") data.duplicateOfId = duplicateOfId;
  if (to === "REOPENED") {
    data.resolvedAt = null;
    data.closedAt = null;
    data.dueAt = computeDueAt(now, c.category.slaHours, c.priority);
  }

  await prisma.$transaction(async (tx) => {
    // Optimistic concurrency: only apply if nobody changed the status meanwhile.
    const updated = await tx.complaint.updateMany({ where: { id: c.id, status: c.status }, data });
    if (updated.count !== 1) throw conflict("This complaint was just updated by someone else. Refresh and try again.");
    await tx.complaintStatusHistory.create({
      data: { complaintId: c.id, fromStatus: c.status, toStatus: to, actorId: actor.id, reason: input.reason ?? (to === "RESOLVED" ? input.resolutionNote : null) },
    });
    if (evidenceIds.length) await tx.attachment.updateMany({ where: { id: { in: evidenceIds } }, data: { complaintId: c.id } });
    if (kind === "ADMIN") {
      await audit({ actorId: actor.id, action: "complaint.status", entityType: "Complaint", entityId: c.id, summary: `${c.reference}: ${c.status} → ${to}`, before: { status: c.status }, after: { status: to, reason: input.reason }, ipAddress: ip }, tx);
    }
  });

  const link = (admin: boolean) => (admin ? `/admin/complaints/${c.id}` : `/portal/complaints/${c.id}`);
  if (kind === "ADMIN" && c.reporterId !== actor.id) {
    const extra = to === "RESOLVED" ? " Please review the resolution and tell us if the problem is fixed." : input.reason ? ` Note from the ward office: ${input.reason}` : "";
    await notifyUsers([c.reporterId], {
      type: "complaint.status",
      title: `${c.reference} is now ${STATUS_LABELS[to].toLowerCase()}`,
      body: `Your complaint status changed from ${STATUS_LABELS[c.status as Status].toLowerCase()} to ${STATUS_LABELS[to].toLowerCase()}.${extra}`,
      link: link(false),
      email: ["RESOLVED", "REJECTED", "DUPLICATE", "REOPENED", "ASSIGNED"].includes(to),
    });
  } else if (kind === "CITIZEN") {
    await notifyWardAdmins(c.wardId, {
      type: to === "REOPEN_REQUESTED" ? "complaint.reopen_requested" : "complaint.closed_by_citizen",
      title: to === "REOPEN_REQUESTED" ? `Reopen requested for ${c.reference}` : `${c.reference} confirmed resolved by citizen`,
      body: input.reason ?? "The citizen confirmed the resolution.",
      link: link(true),
    });
  }
  return { id: c.id, status: to };
}

type AssignInput = z.infer<typeof assignSchema>;

export async function assignComplaint(actor: Actor, id: string, input: AssignInput, ip?: string) {
  const { c, kind } = await loadForCommand(actor, id);
  if (kind !== "ADMIN") throw notFound("Complaint");
  const allowedFrom: ComplaintStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"];
  if (!allowedFrom.includes(c.status)) throw unprocessable("INVALID_STATE", `A ${STATUS_LABELS[c.status as Status].toLowerCase()} complaint cannot be assigned.`);

  const dept = await prisma.department.findFirst({ where: { id: input.departmentId, isActive: true } });
  if (!dept) throw unprocessable("INVALID_DEPARTMENT", "Choose an active department.");
  if (input.staffId) {
    const staff = await prisma.staffMember.findFirst({ where: { id: input.staffId, departmentId: dept.id, isActive: true } });
    if (!staff) throw unprocessable("INVALID_STAFF", "The selected staff member does not belong to this department.");
  }

  // Assigning moves the complaint forward through the documented lifecycle,
  // recording each step: Submitted → Under review → Assigned.
  const steps: Array<[ComplaintStatus, ComplaintStatus]> = [];
  if (c.status === "SUBMITTED") steps.push(["SUBMITTED", "UNDER_REVIEW"], ["UNDER_REVIEW", "ASSIGNED"]);
  else if (c.status === "UNDER_REVIEW" || c.status === "REOPENED") steps.push([c.status, "ASSIGNED"]);
  const finalStatus = steps.length ? steps[steps.length - 1][1] : c.status;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.updateMany({
      where: { id: c.id, status: c.status },
      data: { departmentId: dept.id, assignedStaffId: input.staffId ?? null, status: finalStatus },
    });
    if (updated.count !== 1) throw conflict("This complaint was just updated by someone else. Refresh and try again.");
    await tx.complaintAssignment.create({ data: { complaintId: c.id, departmentId: dept.id, staffId: input.staffId ?? null, assignedById: actor.id, note: input.note } });
    for (const [from, to] of steps) {
      await tx.complaintStatusHistory.create({ data: { complaintId: c.id, fromStatus: from, toStatus: to, actorId: actor.id, reason: to === "ASSIGNED" ? `Assigned to ${dept.name}` : null } });
    }
    await audit({ actorId: actor.id, action: "complaint.assign", entityType: "Complaint", entityId: c.id, summary: `${c.reference} assigned to ${dept.name}`, before: { departmentId: c.departmentId, status: c.status }, after: { departmentId: dept.id, staffId: input.staffId, status: finalStatus }, ipAddress: ip }, tx);
  });

  if (finalStatus === "ASSIGNED" && c.status !== "ASSIGNED") {
    await notifyUsers([c.reporterId], {
      type: "complaint.status",
      title: `${c.reference} has been assigned`,
      body: `Your complaint has been assigned to the ${dept.name}.`,
      link: `/portal/complaints/${c.id}`,
      email: true,
    });
  }
  return { id: c.id, status: finalStatus };
}

type PriorityInput = z.infer<typeof prioritySchema>;

export async function changePriority(actor: Actor, id: string, input: PriorityInput, ip?: string) {
  const { c, kind } = await loadForCommand(actor, id);
  if (kind !== "ADMIN") throw notFound("Complaint");
  if (c.priority === input.priority) return { id: c.id, priority: c.priority };
  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: c.id },
      data: { priority: input.priority, dueAt: computeDueAt(c.createdAt, c.category.slaHours, input.priority as Priority) },
    });
    await tx.complaintComment.create({
      data: { complaintId: c.id, authorId: actor.id, visibility: "INTERNAL", body: `Priority changed from ${c.priority} to ${input.priority}. Reason: ${input.reason}` },
    });
    await audit({ actorId: actor.id, action: "complaint.priority", entityType: "Complaint", entityId: c.id, summary: `${c.reference}: priority ${c.priority} → ${input.priority}`, before: { priority: c.priority }, after: { priority: input.priority, reason: input.reason }, ipAddress: ip }, tx);
  });
  return { id: c.id, priority: input.priority };
}

type CommentInput = z.infer<typeof commentSchema>;

export async function addComment(actor: Actor, id: string, input: CommentInput) {
  const { c, kind } = await loadForCommand(actor, id);
  const visibility = kind === "ADMIN" ? input.visibility : "PUBLIC"; // citizens cannot write internal notes
  const attachmentIds = await claimAttachments(actor, input.attachmentIds, "COMMENT");
  const comment = await prisma.$transaction(async (tx) => {
    const m = await tx.complaintComment.create({ data: { complaintId: c.id, authorId: actor.id, body: input.body, visibility }, select: { id: true } });
    if (attachmentIds.length) await tx.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { commentId: m.id, complaintId: c.id } });
    return m;
  });
  if (kind === "CITIZEN") {
    await notifyWardAdmins(c.wardId, { type: "complaint.comment", title: `New citizen update on ${c.reference}`, body: input.body.slice(0, 200), link: `/admin/complaints/${c.id}` });
  } else if (visibility === "PUBLIC" && c.reporterId !== actor.id) {
    await notifyUsers([c.reporterId], { type: "complaint.comment", title: `Update on ${c.reference}`, body: input.body.slice(0, 300), link: `/portal/complaints/${c.id}`, email: true });
  }
  return comment;
}

type FeedbackInput = z.infer<typeof feedbackSchema>;

export async function submitFeedback(actor: Actor, id: string, input: FeedbackInput) {
  const c = await prisma.complaint.findUnique({ where: { id }, select: { id: true, reference: true, reporterId: true, status: true, resolvedAt: true, wardId: true } });
  if (!c || c.reporterId !== actor.id) throw notFound("Complaint");
  if (c.status !== "RESOLVED") throw unprocessable("INVALID_STATE", "Feedback can be given once the complaint is marked resolved.");
  const already = await prisma.complaintFeedback.findFirst({ where: { complaintId: c.id, createdAt: { gte: c.resolvedAt ?? new Date(0) } } });
  if (already) throw conflict("You have already reviewed this resolution.");

  await prisma.complaintFeedback.create({ data: { complaintId: c.id, citizenId: actor.id, rating: input.rating, satisfied: input.satisfied, comment: input.comment } });
  if (input.satisfied) {
    await changeStatus(actor, c.id, { status: "CLOSED", reason: "Citizen confirmed the problem is fixed.", evidenceIds: [] });
    return { closed: true };
  }
  return { closed: false };
}

// ─── Community support ("me too") ───────────────────────────────────────────

const SUPPORT_MILESTONES = [1, 5, 10, 25, 50, 100];

/**
 * Open, public reports in a ward. Privacy-safe by construction: only the
 * reference, title, category, status, date and support count leave the server —
 * never the reporter, description, address, location or photos.
 */
export async function listPublicIssues(viewerId: string | null, q: { wardId: string; categoryId?: string; limit: number }) {
  const rows = await prisma.complaint.findMany({
    where: { wardId: q.wardId, isPublic: true, status: { in: OPEN }, ...(q.categoryId ? { categoryId: q.categoryId } : {}) },
    orderBy: [{ supportCount: "desc" }, { createdAt: "desc" }],
    take: q.limit,
    select: {
      id: true, reference: true, title: true, status: true, createdAt: true, supportCount: true, reporterId: true,
      category: { select: { name: true, slug: true } },
      supports: { where: { userId: viewerId ?? "__anonymous__" }, select: { id: true } },
    },
  });
  return rows.map(({ reporterId, supports, ...c }) => ({ ...c, mine: !!viewerId && reporterId === viewerId, supportedByMe: supports.length > 0 }));
}

export async function supportComplaint(actor: Actor, id: string) {
  const c = await prisma.complaint.findUnique({ where: { id }, select: { id: true, reference: true, title: true, isPublic: true, status: true, reporterId: true, supportCount: true } });
  if (!c || !c.isPublic) throw notFound("Complaint");
  if (c.reporterId === actor.id) throw unprocessable("OWN_COMPLAINT", "You reported this issue, so it already counts.");
  if (!OPEN.includes(c.status)) throw unprocessable("NOT_OPEN", "Only open issues can be supported.");
  try {
    const [, updated] = await prisma.$transaction([
      prisma.complaintSupport.create({ data: { complaintId: c.id, userId: actor.id } }),
      prisma.complaint.update({ where: { id: c.id }, data: { supportCount: { increment: 1 } }, select: { supportCount: true } }),
    ]);
    if (SUPPORT_MILESTONES.includes(updated.supportCount)) {
      await notifyUsers([c.reporterId], {
        type: "complaint.support",
        title: `${updated.supportCount} ${updated.supportCount === 1 ? "neighbour supports" : "neighbours support"} your report`,
        body: `Residents in your ward confirmed “${c.title}” (${c.reference}). Supported issues are easier for the ward office to prioritise.`,
        link: `/portal/complaints/${c.id}`,
      });
    }
    return { supported: true, supportCount: updated.supportCount };
  } catch (err) {
    // Already supported: idempotent success.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { supported: true, supportCount: c.supportCount };
    throw err;
  }
}

export async function unsupportComplaint(actor: Actor, id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const removed = await tx.complaintSupport.deleteMany({ where: { complaintId: id, userId: actor.id } });
    if (removed.count === 0) {
      const c = await tx.complaint.findUnique({ where: { id }, select: { supportCount: true, isPublic: true } });
      if (!c || !c.isPublic) throw notFound("Complaint");
      return c.supportCount;
    }
    const c = await tx.complaint.update({ where: { id }, data: { supportCount: { decrement: 1 } }, select: { supportCount: true } });
    return c.supportCount;
  });
  return { supported: false, supportCount: Math.max(0, result) };
}

/** The reporter or an in-scope administrator (moderation) can show/hide a report from other residents. */
export async function setComplaintVisibility(actor: Actor, id: string, isPublic: boolean, ip?: string) {
  const { c, kind } = await loadForCommand(actor, id);
  await prisma.complaint.update({ where: { id: c.id }, data: { isPublic } });
  if (kind === "ADMIN") {
    await audit({ actorId: actor.id, action: isPublic ? "complaint.make_public" : "complaint.hide_public", entityType: "Complaint", entityId: c.id, summary: c.reference, ipAddress: ip });
  }
  return { id: c.id, isPublic };
}
