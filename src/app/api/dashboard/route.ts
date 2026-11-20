import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { getDashboard } from "@/lib/services/analytics";
import { parseMonthKey } from "@/lib/domain/period";

const q = z.object({ state: z.string().max(64).optional(), district: z.string().max(64).optional(), localBody: z.string().max(64).optional(), ward: z.string().max(64).optional(), month: z.string().optional(), range: z.enum(["6", "12", "24"]).default("12") });

/** Admin dashboard data, restricted to the caller's geographic scope. */
export const GET = handler({ auth: "admin" }, async ({ req, actor }) => {
  const f = parseQuery(req, q);
  return getDashboard(actor, { stateId: f.state, districtId: f.district, localBodyId: f.localBody, wardId: f.ward }, parseMonthKey(f.month), { trendMonths: Number(f.range) });
});
