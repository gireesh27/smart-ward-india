// Delete uploads that were never attached to a complaint, comment or project
// within 24 hours (abandoned forms). Safe to run on a schedule (e.g. hourly cron).
import { prisma } from "../src/lib/db";
import { deleteObject } from "../src/lib/storage";

async function main() {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const stale = await prisma.attachment.findMany({ where: { complaintId: null, commentId: null, projectId: null, createdAt: { lt: cutoff } }, select: { id: true, storageKey: true } });
  let removed = 0;
  for (const a of stale) {
    try { await deleteObject(a.storageKey); await prisma.attachment.delete({ where: { id: a.id } }); removed++; }
    catch (err) { console.warn(`Could not remove ${a.id}: ${(err as Error).message}`); }
  }
  console.log(`Removed ${removed} of ${stale.length} abandoned uploads.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
