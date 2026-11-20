import { handler } from "@/lib/api";
import { staffSchema } from "@/lib/validation";
import { createStaff } from "@/lib/services/org";

export const POST = handler({ auth: "admin", body: staffSchema }, async ({ actor, body, ip }) => createStaff(actor, body, ip));
