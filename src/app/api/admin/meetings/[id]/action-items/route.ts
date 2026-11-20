import { z } from "zod";
import { handler } from "@/lib/api";
import { actionItemSchema } from "@/lib/validation";
import { addActionItem, setActionItemStatus } from "@/lib/services/meetings";

export const POST = handler({ auth: "admin", body: actionItemSchema }, async ({ actor, params, body }) => addActionItem(actor, params.id, body));
const patch = z.object({ itemId: z.string().max(64), status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]) });
export const PATCH = handler({ auth: "admin", body: patch }, async ({ actor, params, body }) => setActionItemStatus(actor, params.id, body.itemId, body.status));
