import { handler } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { upsertCategory } from "@/lib/services/org";

export const POST = handler({ auth: "admin", body: categorySchema }, async ({ actor, body, ip }) => upsertCategory(actor, null, body, ip));
