import { handler } from "@/lib/api";
import { visibilitySchema } from "@/lib/validation";
import { setComplaintVisibility } from "@/lib/services/complaints";

/** Reporter (own complaint) or in-scope admin: show or hide a report from other residents. */
export const PATCH = handler({ auth: "user", body: visibilitySchema }, async ({ actor, params, body, ip }) => setComplaintVisibility(actor, params.id, body.isPublic, ip));
