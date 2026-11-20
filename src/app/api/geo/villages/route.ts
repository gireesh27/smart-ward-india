import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { listVillages } from "@/lib/services/geo";

const q = z.object({ mandal: z.string().regex(/^\d{1,8}$/) });

/** GET /api/geo/villages?mandal=<LGD sub-district code> → villages of that mandal with their Gram Panchayat. */
export const GET = handler({ auth: "public", rateLimit: { bucket: "geo", limit: 300, windowSec: 60 } }, async ({ req }) => listVillages(parseQuery(req, q).mandal));
