import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";
import { redact } from "./logger";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
};

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(redact(v))) as Prisma.InputJsonValue));

export async function audit(entry: AuditEntry, db: Tx = prisma) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: json(entry.before),
      after: json(entry.after),
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
