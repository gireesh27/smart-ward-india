import { z } from "zod";
import { handler } from "@/lib/api";
import { setArchived } from "@/lib/services/projects";

export const POST = handler({ auth: "admin", body: z.object({ archived: z.boolean() }) }, async ({ actor, params, body, ip }) => setArchived(actor, params.id, body.archived, ip));
