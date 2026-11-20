import { z } from "zod";
import { handler } from "@/lib/api";
import { setWardActive } from "@/lib/services/geo";

export const PATCH = handler({ auth: "admin", body: z.object({ isActive: z.boolean() }) }, async ({ actor, params, body, ip }) => setWardActive(actor, params.id, body.isActive, ip));
