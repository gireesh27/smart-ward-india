import { prisma } from "./db";
import { emailLayout, sendMail } from "./mailer";

export type NotificationPayload = { type: string; title: string; body: string; link?: string; email?: boolean };

/** In-app notifications respect each user's preferences; email is optional per event. */
export async function notifyUsers(userIds: string[], p: NotificationPayload) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true, email: true, name: true, notifyEmail: true, notifyInApp: true },
  });
  const inApp = users.filter((u) => u.notifyInApp);
  if (inApp.length) {
    await prisma.notification.createMany({
      data: inApp.map((u) => ({ userId: u.id, type: p.type, title: p.title, body: p.body, link: p.link ?? null })),
    });
  }
  if (p.email) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await Promise.all(
      users.filter((u) => u.notifyEmail).map((u) =>
        sendMail(u.email, p.title, emailLayout({ heading: p.title, paragraphs: [`Hello ${u.name},`, p.body], cta: p.link ? { label: "Open Smart Ward India", url: base + p.link } : undefined })),
      ),
    );
  }
}

/** Ward and district administrators whose scope covers a ward. */
export async function wardAdminIds(wardId: string): Promise<string[]> {
  const ward = await prisma.ward.findUnique({ where: { id: wardId }, select: { localBodyId: true, localBody: { select: { districtId: true, district: { select: { stateId: true } } } } } });
  if (!ward) return [];
  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["WARD_ADMIN", "DISTRICT_ADMIN"] },
      scopes: { some: { OR: [{ wardId }, { localBodyId: ward.localBodyId }, { districtId: ward.localBody.districtId }, { stateId: ward.localBody.district.stateId }] } },
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function notifyWardAdmins(wardId: string, p: NotificationPayload) {
  await notifyUsers(await wardAdminIds(wardId), p);
}
