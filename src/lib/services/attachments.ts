import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { env } from "../env";
import { canAccessWard, type Actor } from "../authz";
import { AppError, forbidden, unprocessable } from "../errors";
import { EXTENSION, sanitizeFileName, validateUpload, type UploadPurpose } from "../domain/files";
import { putObject } from "../storage";

const ADMIN_ONLY: UploadPurpose[] = ["RESOLUTION", "PROJECT_PHOTO", "PROJECT_DOCUMENT"];
const PENDING_LIMIT_PER_DAY = 40;

export async function storeUpload(actor: Actor, file: File, purpose: UploadPurpose) {
  if (ADMIN_ONLY.includes(purpose) && !actor.isAdmin) throw forbidden("Only administrators can upload this type of file.");
  const pending = await prisma.attachment.count({
    where: { uploaderId: actor.id, complaintId: null, projectId: null, commentId: null, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (pending >= PENDING_LIMIT_PER_DAY) throw new AppError(429, "TOO_MANY_PENDING_UPLOADS", "You have too many unsubmitted uploads. Submit or wait a day.");

  const { UPLOAD_MAX_BYTES, UPLOAD_MAX_VIDEO_BYTES } = env();
  if (file.size > Math.max(UPLOAD_MAX_BYTES, UPLOAD_MAX_VIDEO_BYTES)) {
    throw unprocessable("INVALID_FILE", `Files must be ${Math.round(Math.max(UPLOAD_MAX_BYTES, UPLOAD_MAX_VIDEO_BYTES) / 1048576)} MB or smaller.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload(bytes, purpose, UPLOAD_MAX_BYTES, UPLOAD_MAX_VIDEO_BYTES);
  if (!check.ok) throw unprocessable("INVALID_FILE", check.message);

  const now = new Date();
  const key = `${purpose.toLowerCase()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXTENSION[check.mime]}`;
  await putObject(key, bytes, check.mime);
  return prisma.attachment.create({
    data: { storageKey: key, fileName: sanitizeFileName(file.name || "upload"), mimeType: check.mime, size: bytes.length, purpose, uploaderId: actor.id },
    select: { id: true, fileName: true, mimeType: true, size: true, purpose: true },
  });
}

/** Central file authorisation: every download goes through this check. */
export async function readableAttachment(actor: Actor | null, id: string) {
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: {
      complaint: { select: { wardId: true, reporterId: true } },
      comment: { select: { visibility: true } },
      project: { select: { wardId: true, isPublic: true, archivedAt: true } },
    },
  });
  if (!att) return null;
  if (att.isPublic && att.project && att.project.isPublic && !att.project.archivedAt) return att;
  if (!actor) return null;
  if (att.uploaderId === actor.id) return att;
  if (att.complaint) {
    if (actor.isAdmin && (await canAccessWard(actor, att.complaint.wardId))) return att;
    if (att.complaint.reporterId === actor.id && (!att.comment || att.comment.visibility === "PUBLIC")) return att;
  }
  if (att.project && actor.isAdmin && (await canAccessWard(actor, att.project.wardId))) return att;
  return null;
}
