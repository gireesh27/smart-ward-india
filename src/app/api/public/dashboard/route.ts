import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { getDashboard } from "@/lib/services/analytics";
import { parseMonthKey } from "@/lib/domain/period";

const q = z.object({ district: z.string().max(64).optional(), ward: z.string().max(64).optional(), month: z.string().optional() });

/** Aggregated, privacy-safe figures: no personal data, no complaint coordinates, no internal notes. */
export const GET = handler({ auth: "public", rateLimit: { bucket: "public-dash", limit: 120, windowSec: 60 } }, async ({ req }) => {
  const f = parseQuery(req, q);
  const d = await getDashboard(null, { districtId: f.district, wardId: f.ward }, parseMonthKey(f.month), { publicView: true });
  return {
    month: d.month, scoreAsOf: d.scoreAsOf, kpis: { ...d.kpis, newComplaints: undefined },
    indicators: d.indicators, trends: d.trends, distribution: d.distribution,
    wards: d.performance,
    projects: d.projects.map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, progress: p.progress, ward: p.ward })),
    alerts: d.insights.map((i) => ({ title: i.title, severity: i.severity, ward: i.ward, generatedAt: i.generatedAt })),
  };
});
