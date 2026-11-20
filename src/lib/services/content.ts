import { prisma } from "../db";
import { canAccessDistrict, canAccessWard, districtScopeWhere, wardScopeWhere, assertDistrictOrSuper, assertSuperAdmin, type Actor } from "../authz";
import { forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { setSetting, type SiteContent } from "../settings";
import { notifyUsers } from "../notifications";
import type { z } from "zod";
import type { announcementSchema, contactSchema, inquiryUpdateSchema } from "../validation";

// ─── Announcements ──────────────────────────────────────────────────────────

export async function listAnnouncements(actor: Actor) {
  const where = actor.scope.all ? {} : { OR: [{ createdById: actor.id }, { ward: wardScopeWhere(actor) }, { district: districtScopeWhere(actor) }] };
  return prisma.announcement.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, include: { ward: { select: { number: true, localBody: { select: { name: true } } } }, district: { select: { name: true } } } });
}

/** Published announcements relevant to a citizen (their ward, district, or platform-wide). */
export async function publicAnnouncements(wardId?: string | null) {
  const ward = wardId ? await prisma.ward.findUnique({ where: { id: wardId }, select: { localBody: { select: { districtId: true } } } }) : null;
  return prisma.announcement.findMany({
    where: { isPublished: true, OR: [{ wardId: null, districtId: null }, ...(wardId ? [{ wardId }] : []), ...(ward ? [{ districtId: ward.localBody.districtId, wardId: null }] : [])] },
    orderBy: { publishedAt: "desc" }, take: 5,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
}

export async function createAnnouncement(actor: Actor, input: z.infer<typeof announcementSchema>, ip?: string) {
  if (input.wardId && !(await canAccessWard(actor, input.wardId))) throw forbidden("You can only publish to wards in your scope.");
  if (input.districtId && !(await canAccessDistrict(actor, input.districtId))) throw forbidden("You can only publish to districts in your scope.");
  if (!input.wardId && !input.districtId && actor.role !== "SUPER_ADMIN") throw forbidden("Only super administrators can publish platform-wide announcements. Choose a ward.");
  if (input.districtId && actor.role === "WARD_ADMIN") throw forbidden("Ward administrators publish to wards only.");
  const a = await prisma.announcement.create({ data: { ...input, createdById: actor.id, publishedAt: input.isPublished ? new Date() : null } });
  await audit({ actorId: actor.id, action: "announcement.create", entityType: "Announcement", entityId: a.id, summary: a.title, ipAddress: ip });
  if (a.isPublished && a.wardId) {
    const residents = await prisma.user.findMany({ where: { wardId: a.wardId, role: "CITIZEN", isActive: true }, select: { id: true }, take: 5000 });
    await notifyUsers(residents.map((r) => r.id), { type: "announcement", title: a.title, body: a.body.slice(0, 280), link: "/portal" });
  }
  return { id: a.id };
}

export async function setAnnouncementPublished(actor: Actor, id: string, isPublished: boolean, ip?: string) {
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw notFound("Announcement");
  if (a.wardId ? !(await canAccessWard(actor, a.wardId)) : actor.role !== "SUPER_ADMIN" && a.createdById !== actor.id) throw notFound("Announcement");
  await prisma.announcement.update({ where: { id }, data: { isPublished, publishedAt: isPublished ? a.publishedAt ?? new Date() : a.publishedAt } });
  await audit({ actorId: actor.id, action: isPublished ? "announcement.publish" : "announcement.unpublish", entityType: "Announcement", entityId: id, summary: a.title, ipAddress: ip });
  return { id };
}

// ─── Partner / contact inquiries ────────────────────────────────────────────

export async function createInquiry(input: z.infer<typeof contactSchema>) {
  const { website: _honeypot, ...data } = input;
  const row = await prisma.partnerInquiry.create({ data, select: { id: true } });
  const supers = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
  await notifyUsers(supers.map((s) => s.id), { type: "inquiry.new", title: `New ${data.type.toLowerCase()} inquiry`, body: `${data.name}${data.organization ? ` (${data.organization})` : ""}`, link: "/admin/settings?tab=inquiries" });
  return row;
}

export async function listInquiries(actor: Actor) {
  assertDistrictOrSuper(actor);
  return prisma.partnerInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function updateInquiry(actor: Actor, id: string, input: z.infer<typeof inquiryUpdateSchema>, ip?: string) {
  assertDistrictOrSuper(actor);
  const before = await prisma.partnerInquiry.findUnique({ where: { id } });
  if (!before) throw notFound("Inquiry");
  await prisma.partnerInquiry.update({ where: { id }, data: input });
  await audit({ actorId: actor.id, action: "inquiry.update", entityType: "PartnerInquiry", entityId: id, before: { status: before.status }, after: { status: input.status }, ipAddress: ip });
  return { id };
}

// ─── Site content ───────────────────────────────────────────────────────────

export async function saveSiteContent(actor: Actor, content: SiteContent, ip?: string) {
  assertSuperAdmin(actor);
  await setSetting("content.site", content, actor.id);
  await audit({ actorId: actor.id, action: "content.update", entityType: "Setting", entityId: "content.site", after: content, ipAddress: ip });
}
