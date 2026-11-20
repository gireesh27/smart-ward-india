import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { geoPathFor } from "@/lib/services/geo";

const q = z.object({ ward: z.string().max(64).optional(), localBody: z.string().max(64).optional(), district: z.string().max(64).optional() });

export const GET = handler({ auth: "public" }, async ({ req }) => {
  const f = parseQuery(req, q);
  return geoPathFor({ wardId: f.ward, localBodyId: f.localBody, districtId: f.district });
});
