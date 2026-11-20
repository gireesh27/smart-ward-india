import { handler } from "@/lib/api";
import { geoCreateSchema } from "@/lib/validation";
import { createGeo } from "@/lib/services/geo";

export const POST = handler({ auth: "admin", body: geoCreateSchema }, async ({ actor, body, ip }) => createGeo(actor, body, ip));
