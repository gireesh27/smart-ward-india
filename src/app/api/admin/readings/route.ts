import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertWardAccess } from "@/lib/authz";
import { readingSchema } from "@/lib/validation";
import { parseMonthKey } from "@/lib/domain/period";
import { audit } from "@/lib/audit";
import { recomputeSnapshots } from "@/lib/services/scores";

/** Record (or correct) one monthly indicator value for a ward, then rescore that ward-month. */
export const POST = handler({ auth: "admin", body: readingSchema }, async ({ actor, body, ip }) => {
  await assertWardAccess(actor, body.wardId, "Ward");
  const period = parseMonthKey(body.period);
  const prev = await prisma.indicatorReading.findUnique({ where: { wardId_indicatorId_period: { wardId: body.wardId, indicatorId: body.indicatorId, period } } });
  await prisma.indicatorReading.upsert({
    where: { wardId_indicatorId_period: { wardId: body.wardId, indicatorId: body.indicatorId, period } },
    create: { wardId: body.wardId, indicatorId: body.indicatorId, period, value: body.value, source: `manual:${actor.id}` },
    update: { value: body.value, source: `manual:${actor.id}` },
  });
  await recomputeSnapshots({ wardIds: [body.wardId], periods: [period] });
  await audit({ actorId: actor.id, action: "indicator.reading", entityType: "IndicatorReading", entityId: `${body.wardId}:${body.indicatorId}:${body.period}`, before: prev ? { value: prev.value } : null, after: { value: body.value }, ipAddress: ip });
  return { ok: true };
});
