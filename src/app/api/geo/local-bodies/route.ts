import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { listLocalBodies } from "@/lib/services/geo";

const q = z.object({ district: z.string().min(1).max(64), q: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(2000).optional(), scoped: z.enum(["0", "1"]).optional() });

/** Gram Panchayats and urban local bodies of a district, searchable by name or mandal. */
export const GET = handler({ auth: "public", rateLimit: { bucket: "geo", limit: 300, windowSec: 60 } }, async ({ req, actor }) => {
  const f = parseQuery(req, q);
  return listLocalBodies({ districtId: f.district, q: f.q, limit: f.limit, actor: f.scoped === "1" && actor?.isAdmin ? actor : null });
});
