import { handler } from "@/lib/api";
import { contentSchema } from "@/lib/validation";
import { saveSiteContent } from "@/lib/services/content";

export const PUT = handler({ auth: "admin", body: contentSchema }, async ({ actor, body, ip }) => { await saveSiteContent(actor, body, ip); return { ok: true }; });
