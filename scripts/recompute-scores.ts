// Rebuild every ScoreSnapshot from stored indicator readings.
import { prisma } from "../src/lib/db";
import { recomputeSnapshots } from "../src/lib/services/scores";

async function main() {
  const res = await recomputeSnapshots();
  console.log(`Recomputed ${res.snapshots} ward-month snapshots.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
