import { handler } from "@/lib/api";
import { departmentSchema } from "@/lib/validation";
import { createDepartment } from "@/lib/services/org";

export const POST = handler({ auth: "admin", body: departmentSchema }, async ({ actor, body, ip }) => createDepartment(actor, body, ip));
