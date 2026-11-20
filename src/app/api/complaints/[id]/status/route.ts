import { handler } from "@/lib/api";
import { statusChangeSchema } from "@/lib/validation";
import { changeStatus } from "@/lib/services/complaints";

export const POST = handler({ auth: "user", body: statusChangeSchema }, async ({ actor, params, body, ip }) => changeStatus(actor, params.id, body, ip));
