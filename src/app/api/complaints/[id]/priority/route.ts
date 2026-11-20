import { handler } from "@/lib/api";
import { prioritySchema } from "@/lib/validation";
import { changePriority } from "@/lib/services/complaints";

export const POST = handler({ auth: "admin", body: prioritySchema }, async ({ actor, params, body, ip }) => changePriority(actor, params.id, body, ip));
