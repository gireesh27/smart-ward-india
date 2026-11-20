import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { listDistricts } from "@/lib/services/geo";

const q = z.object({ state: z.string().max(64).optional(), scoped: z.enum(["0", "1"]).optional() });

/** ?scoped=1 limits results to the signed-in administrator's area. */
export const GET = handler({ auth: "public" }, async ({ req, actor }) => {
  const f = parseQuery(req, q);
  return listDistricts(f.state, f.scoped === "1" && actor?.isAdmin ? actor : null);
});
