import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { listWards } from "@/lib/services/geo";

const q = z.object({ localBody: z.string().min(1).max(64), scoped: z.enum(["0", "1"]).optional() });

export const GET = handler({ auth: "public", rateLimit: { bucket: "geo", limit: 300, windowSec: 60 } }, async ({ req, actor }) => {
  const f = parseQuery(req, q);
  return listWards(f.localBody, f.scoped === "1" && actor?.isAdmin ? actor : null);
});
