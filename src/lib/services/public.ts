import { prisma } from "../db";
import { getDashboard } from "./analytics";

const ALERT_LABEL: Record<string, string> = {
  WATER_SUPPLY_RISK: "Water Shortage",
  ROAD_REPAIR_PRIORITY: "Road Damage",
  DRAINAGE_REVIEW: "Drainage Overflow",
};
const ACTION_LABEL: Record<string, string> = {
  WATER_SUPPLY_RISK: "Improve water supply",
  ROAD_REPAIR_PRIORITY: "Repair roads",
  DRAINAGE_REVIEW: "Upgrade drainage system",
};

const WARD_SELECT = {
  id: true, localBodyId: true, latitude: true, longitude: true, number: true,
  localBody: { select: { name: true, districtId: true, district: { select: { name: true, lgdCode: true, latitude: true, longitude: true, state: { select: { name: true } } } } } },
} as const;

/** Landing preview ward: the requested one, else the ward with the most recent activity, else the first urban ward. */
export async function featuredWard(requested?: string) {
  if (requested) {
    const w = await prisma.ward.findFirst({ where: { id: requested, isActive: true }, select: WARD_SELECT });
    if (w) return w;
  }
  const busiest = await prisma.complaint.groupBy({ by: ["wardId"], where: { createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, _count: { _all: true }, orderBy: { _count: { wardId: "desc" } }, take: 1 });
  if (busiest[0]) {
    const w = await prisma.ward.findFirst({ where: { id: busiest[0].wardId, isActive: true }, select: WARD_SELECT });
    if (w) return w;
  }
  return prisma.ward.findFirst({ where: { isActive: true, localBody: { type: { not: "GRAM_PANCHAYAT" } } }, orderBy: [{ localBody: { name: "asc" } }, { number: "asc" }], select: WARD_SELECT });
}

/** Everything the landing page shows, from the database, with no personal data. */
export async function landingData(requestedWard?: string) {
  const ward = await featuredWard(requestedWard);
  if (!ward) return null;
  const now = new Date();
  const [wardDash, districtDash, siblings] = await Promise.all([
    getDashboard(null, { wardId: ward.id }, now, { publicView: true, trendMonths: 2 }),
    getDashboard(null, { districtId: ward.localBody.districtId }, now, { publicView: true, trendMonths: 2 }),
    prisma.ward.findMany({ where: { localBodyId: ward.localBodyId, isActive: true }, orderBy: { number: "asc" }, select: { id: true, number: true, localBody: { select: { name: true } } } }),
  ]);
  // One alert per rule type, highest severity first.
  const seen = new Set<string>();
  const alerts = districtDash.insights
    .filter((i) => { if (seen.has(i.ruleKey)) return false; seen.add(i.ruleKey); return true; })
    .slice(0, 3)
    .map((i) => ({ id: i.id, label: ALERT_LABEL[i.ruleKey] ?? `${i.category?.name ?? "Service"} Backlog`, severity: i.severity, action: ACTION_LABEL[i.ruleKey] ?? `Clear ${i.category?.name.toLowerCase() ?? "service"} backlog` }));
  return { ward, wardDash, districtDash, alerts, wards: siblings.map((s) => ({ id: s.id, number: s.number, localBody: s.localBody.name })) };
}
