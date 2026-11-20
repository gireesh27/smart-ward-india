import { handler, parseQuery } from "@/lib/api";
import { publicIssuesSchema } from "@/lib/validation";
import { listPublicIssues } from "@/lib/services/complaints";

/** Open public reports in a ward (privacy-safe fields only), so residents can support instead of duplicating. */
export const GET = handler({ auth: "public", rateLimit: { bucket: "public-issues", limit: 120, windowSec: 60 } }, async ({ req, actor }) => {
  const q = parseQuery(req, publicIssuesSchema);
  return listPublicIssues(actor?.id ?? null, { wardId: q.ward, categoryId: q.category, limit: q.limit });
});
