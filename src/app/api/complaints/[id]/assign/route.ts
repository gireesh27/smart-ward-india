import { handler } from "@/lib/api";
import { assignSchema } from "@/lib/validation";
import { assignComplaint } from "@/lib/services/complaints";

export const POST = handler({ auth: "admin", body: assignSchema }, async ({ actor, params, body, ip }) => assignComplaint(actor, params.id, body, ip));
