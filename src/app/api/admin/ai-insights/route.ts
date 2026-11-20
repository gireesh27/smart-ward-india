import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { generateAiReport, listAiReports } from "@/lib/services/ai-insights";

const q = z.object({ district: z.string().max(64).optional() });
const body = z.object({ districtId: z.string().max(64).optional() });

/** GET: recent AI reports for a district (or state-wide for super admins). */
export const GET = handler({ auth: "admin" }, async ({ req, actor }) => listAiReports(actor, parseQuery(req, q).district));

/** POST: generate a new AI analysis from aggregated data. Rate limited: models are slow and may cost money. */
export const POST = handler({ auth: "admin", body, rateLimit: { bucket: "ai-report", limit: 6, windowSec: 600, per: "user" } }, async ({ actor, body, ip }) => {
  const r = await generateAiReport(actor, body.districtId || undefined, ip);
  return { id: r.id, status: r.status };
});
