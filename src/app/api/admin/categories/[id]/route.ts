import { handler } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { upsertCategory } from "@/lib/services/org";

export const PUT = handler({ auth: "admin", body: categorySchema }, async ({ actor, params, body, ip }) => upsertCategory(actor, params.id, body, ip));
