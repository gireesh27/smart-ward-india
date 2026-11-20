import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { profileSchema } from "@/lib/validation";
import { unprocessable } from "@/lib/errors";

export const PATCH = handler({ auth: "user", body: profileSchema }, async ({ actor, body }) => {
  if (body.wardId) {
    const ward = await prisma.ward.findFirst({ where: { id: body.wardId, isActive: true } });
    if (!ward) throw unprocessable("INVALID_WARD", "Choose an active ward.");
  }
  await prisma.user.update({
    where: { id: actor.id },
    data: { name: body.name, phone: body.phone ?? null, wardId: body.wardId ?? null, notifyEmail: body.notifyEmail, notifyInApp: body.notifyInApp },
  });
  return { ok: true };
});
