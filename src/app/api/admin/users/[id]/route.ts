import { handler } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";
import { updateUser } from "@/lib/services/users";

export const PATCH = handler({ auth: "admin", body: userUpdateSchema }, async ({ actor, params, body, ip }) => updateUser(actor, params.id, body, ip));
