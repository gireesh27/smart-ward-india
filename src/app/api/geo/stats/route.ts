import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { parseMonthKey } from "@/lib/domain/period";
import { areaStats } from "@/lib/services/geo-stats";

const q = z.object({ layer: z.enum(["districts", "mandals"]).default("districts"), month: z.string().max(7).optional() });

/** Aggregated, non-personal map statistics keyed by LGD code (district or mandal). */
export const GET = handler({ auth: "public", rateLimit: { bucket: "geo-stats", limit: 120, windowSec: 60 } }, async ({ req }) => {
  const f = parseQuery(req, q);
  return areaStats(f.layer, parseMonthKey(f.month));
});
