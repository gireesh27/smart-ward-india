import { handler } from "@/lib/api";
import { inquiryUpdateSchema } from "@/lib/validation";
import { updateInquiry } from "@/lib/services/content";

export const PATCH = handler({ auth: "admin", body: inquiryUpdateSchema }, async ({ actor, params, body, ip }) => updateInquiry(actor, params.id, body, ip));
