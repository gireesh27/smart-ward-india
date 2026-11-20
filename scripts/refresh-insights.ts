// Re-run all insight rules now (also happens automatically at most hourly when dashboards load).
import { prisma } from "../src/lib/db";
import { generateInsights } from "../src/lib/services/insights";

async function main() {
  const res = await generateInsights();
  console.log(`${res.active} active insights.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
