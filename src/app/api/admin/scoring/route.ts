import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assertSuperAdmin } from "@/lib/authz";
import { indicatorUpdateSchema } from "@/lib/validation";
import { setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { recomputeSnapshots } from "@/lib/services/scores";
import { unprocessable } from "@/lib/errors";

/** Update indicator weights/targets and the coverage threshold, then rebuild every snapshot. */
export const PUT = handler({ auth: "admin", body: indicatorUpdateSchema }, async ({ actor, body, ip }) => {
  assertSuperAdmin(actor);
  if (!body.indicators.some((i) => i.isActive && i.weight > 0)) throw unprocessable("NO_WEIGHT", "At least one active indicator needs a weight above zero.");
  const before = await prisma.indicatorDefinition.findMany();
  await prisma.$transaction(body.indicators.map((i) => prisma.indicatorDefinition.update({ where: { id: i.id }, data: { weight: i.weight, target: i.target, worst: i.worst, isActive: i.isActive } })));
  await setSetting("scoring.minCoverage", body.minCoverage, actor.id);
  const res = await recomputeSnapshots({ replaceAll: true });
  await audit({ actorId: actor.id, action: "scoring.update", entityType: "Setting", entityId: "scoring", before: before.map((b) => ({ key: b.key, weight: b.weight, target: b.target, worst: b.worst, isActive: b.isActive })), after: body, summary: `Recomputed ${res.snapshots} snapshots`, ipAddress: ip });
  return res;
});
