import { z } from "zod";
import { handler } from "@/lib/api";
import { attachProjectFiles } from "@/lib/services/projects";

const schema = z.object({ attachmentIds: z.array(z.string().max(64)).min(1).max(10), isPublic: z.boolean().default(false) });
export const POST = handler({ auth: "admin", body: schema }, async ({ actor, params, body }) => attachProjectFiles(actor, params.id, body.attachmentIds, body.isPublic));
