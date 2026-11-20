import { z } from "zod";
import { handler } from "@/lib/api";
import { setAnnouncementPublished } from "@/lib/services/content";

export const PATCH = handler({ auth: "admin", body: z.object({ isPublished: z.boolean() }) }, async ({ actor, params, body, ip }) => setAnnouncementPublished(actor, params.id, body.isPublished, ip));
