import { z } from "zod";
import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canAccessWard } from "@/lib/authz";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { generateInsights } from "@/lib/services/insights";

/** Re-run every rule now. */
export const POST = handler({ auth: "admin", rateLimit: { bucket: "insights", limit: 10, windowSec: 600, per: "user" } }, async ({ actor, ip }) => {
  const res = await generateInsights();
  await audit({ actorId: actor.id, action: "insights.refresh", entityType: "Insight", summary: `${res.active} active`, ipAddress: ip });
  return res;
});

const patch = z.object({ id: z.string().max(64), status: z.enum(["OPEN", "ACKNOWLEDGED", "DISMISSED"]) });
export const PATCH = handler({ auth: "admin", body: patch }, async ({ actor, body, ip }) => {
  const i = await prisma.insight.findUnique({ where: { id: body.id } });
  if (!i || (i.wardId && !(await canAccessWard(actor, i.wardId)))) throw notFound("Insight");
  await prisma.insight.update({ where: { id: i.id }, data: { status: body.status } });
  await audit({ actorId: actor.id, action: "insight.status", entityType: "Insight", entityId: i.id, before: { status: i.status }, after: { status: body.status }, ipAddress: ip });
  return { id: i.id, status: body.status };
});
