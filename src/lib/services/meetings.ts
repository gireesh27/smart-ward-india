import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { canAccessDistrict, canAccessWard, districtScopeWhere, wardScopeWhere, type Actor } from "../authz";
import { forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { notifyUsers } from "../notifications";
import type { z } from "zod";
import type { meetingSchema, actionItemSchema } from "../validation";

async function canUseDistrict(actor: Actor, districtId: string) {
  return canAccessDistrict(actor, districtId);
}

function visibleWhere(actor: Actor): Prisma.MeetingWhereInput {
  if (actor.scope.all) return {};
  return { OR: [
    { createdById: actor.id },
    { participants: { some: { userId: actor.id } } },
    { ward: wardScopeWhere(actor) },
    { district: districtScopeWhere(actor) },
  ] };
}

export async function listMeetings(actor: Actor) {
  return prisma.meeting.findMany({
    where: visibleWhere(actor), orderBy: { scheduledAt: "desc" }, take: 50,
    include: { district: { select: { name: true } }, ward: { select: { number: true, localBody: { select: { name: true } } } }, _count: { select: { participants: true, actionItems: true } }, actionItems: { where: { status: { not: "DONE" } }, select: { id: true } } },
  });
}

export async function getMeeting(actor: Actor, id: string) {
  const m = await prisma.meeting.findFirst({
    where: { AND: [{ id }, visibleWhere(actor)] },
    include: { district: true, ward: { include: { localBody: true } }, participants: true, actionItems: { orderBy: { createdAt: "asc" } }, createdBy: { select: { name: true } } },
  });
  if (!m) throw notFound("Meeting");
  return m;
}

/** "Name <email>, role" per line → participant rows; emails matching accounts are linked. */
export function parseParticipants(text: string | undefined) {
  return (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 50).map((line) => {
    const m = /^(.*?)\s*(?:<([^>]+)>)?\s*(?:,\s*(.+))?$/.exec(line);
    return { name: (m?.[1] || line).slice(0, 120), email: m?.[2]?.trim().toLowerCase() || null, role: m?.[3]?.trim().slice(0, 80) || null };
  });
}

export async function createMeeting(actor: Actor, input: z.infer<typeof meetingSchema>, ip?: string) {
  if (input.wardId && !(await canAccessWard(actor, input.wardId))) throw forbidden("You can only schedule meetings for wards in your scope.");
  if (input.districtId && !(await canUseDistrict(actor, input.districtId))) throw forbidden("You can only schedule meetings for districts in your scope.");
  const parts = parseParticipants(input.participants);
  const emails = parts.map((p) => p.email).filter((e): e is string => !!e);
  const users = emails.length ? await prisma.user.findMany({ where: { email: { in: emails }, role: { not: "CITIZEN" } }, select: { id: true, email: true } }) : [];
  const m = await prisma.meeting.create({
    data: {
      title: input.title, agenda: input.agenda, scheduledAt: input.scheduledAt, durationMins: input.durationMins, location: input.location,
      districtId: input.districtId, wardId: input.wardId, createdById: actor.id,
      participants: { create: [{ name: actor.name, email: actor.email, role: "Organiser", userId: actor.id }, ...parts.map((p) => ({ ...p, userId: users.find((u) => u.email === p.email)?.id ?? null }))] },
    },
  });
  await audit({ actorId: actor.id, action: "meeting.create", entityType: "Meeting", entityId: m.id, summary: m.title, ipAddress: ip });
  await notifyUsers(users.map((u) => u.id).filter((uid) => uid !== actor.id), {
    type: "meeting.scheduled", title: `Review meeting: ${m.title}`, body: `Scheduled for ${m.scheduledAt.toUTCString()} at ${m.location}.`, link: `/admin/tools/meetings/${m.id}`, email: true,
  });
  return { id: m.id };
}

export async function updateMeeting(actor: Actor, id: string, input: { status?: "SCHEDULED" | "COMPLETED" | "CANCELLED"; minutes?: string }, ip?: string) {
  const m = await getMeeting(actor, id);
  await prisma.meeting.update({ where: { id: m.id }, data: { status: input.status, minutes: input.minutes } });
  await audit({ actorId: actor.id, action: "meeting.update", entityType: "Meeting", entityId: id, summary: m.title, before: { status: m.status }, after: input, ipAddress: ip });
  return { id };
}

export async function addActionItem(actor: Actor, id: string, input: z.infer<typeof actionItemSchema>) {
  const m = await getMeeting(actor, id);
  return prisma.actionItem.create({ data: { meetingId: m.id, description: input.description, ownerName: input.ownerName, dueDate: input.dueDate } });
}

export async function setActionItemStatus(actor: Actor, id: string, itemId: string, status: "OPEN" | "IN_PROGRESS" | "DONE") {
  const m = await getMeeting(actor, id);
  if (!m.actionItems.some((a) => a.id === itemId)) throw notFound("Action item");
  return prisma.actionItem.update({ where: { id: itemId }, data: { status } });
}

export async function openFollowUps(actor: Actor) {
  return prisma.actionItem.findMany({
    where: { status: { not: "DONE" }, meeting: visibleWhere(actor) },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 20,
    include: { meeting: { select: { id: true, title: true } } },
  });
}
