import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { searchPlaces } from "@/lib/services/geo";

const q = z.object({ q: z.string().min(2).max(80) });

/** Find a Gram Panchayat by village name, or a local body by name. */
export const GET = handler({ auth: "public", rateLimit: { bucket: "geo-search", limit: 120, windowSec: 60 } }, async ({ req }) => searchPlaces(parseQuery(req, q).q));
