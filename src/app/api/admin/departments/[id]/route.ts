import { z } from "zod";
import { handler } from "@/lib/api";
import { setDepartmentActive } from "@/lib/services/org";

export const PATCH = handler({ auth: "admin", body: z.object({ isActive: z.boolean() }) }, async ({ actor, params, body, ip }) => setDepartmentActive(actor, params.id, body.isActive, ip));
