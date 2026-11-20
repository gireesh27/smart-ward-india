import { handler } from "@/lib/api";
import { reopenSchema } from "@/lib/validation";
import { changeStatus } from "@/lib/services/complaints";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/db";

/** Citizen asks for a resolved/closed complaint to be reopened (admins review it). */
export const POST = handler({ auth: "user", body: reopenSchema }, async ({ actor, params, body }) => {
  const c = await prisma.complaint.findUnique({ where: { id: params.id }, select: { reporterId: true } });
  if (!c || c.reporterId !== actor.id) throw forbidden("Only the person who reported this complaint can request reopening.");
  return changeStatus({ ...actor, isAdmin: false }, params.id, { status: "REOPEN_REQUESTED", reason: body.reason, evidenceIds: [] });
});
