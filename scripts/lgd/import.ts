/**
 * Production-safe LGD import: upserts the official hierarchy into the configured
 * database without deleting anything.
 *   npm run lgd:import                 (reads data/lgd/andhra-pradesh)
 *   npm run lgd:import -- --dir <dir>  (another converted state/folder)
 */
import { prisma } from "../../src/lib/db";
import { importLgd } from "./import-lib";

async function main() {
  const i = process.argv.indexOf("--dir");
  const t0 = Date.now();
  await importLgd(prisma, { dir: i > -1 ? process.argv[i + 1] : undefined });
  console.log(`Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
