import { handler } from "@/lib/api";
import { manualProgressSchema } from "@/lib/validation";
import { recordManualProgress } from "@/lib/services/projects";

export const POST = handler({ auth: "admin", body: manualProgressSchema }, async ({ actor, params, body, ip }) => recordManualProgress(actor, params.id, body, ip));
