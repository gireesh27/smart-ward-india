import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handler({ auth: "user" }, async ({ actor, req }) => {
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: actor.id, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
  ]);
  return { items, unread };
});

const markSchema = z.object({ ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional() });

export const POST = handler({ auth: "user", body: markSchema }, async ({ actor, body }) => {
  const res = await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
});
