import { handler } from "@/lib/api";
import { supportComplaint, unsupportComplaint } from "@/lib/services/complaints";

const limit = { bucket: "support", limit: 60, windowSec: 600, per: "user" as const };

/** POST: support someone else's public report ("me too"). DELETE: withdraw support. */
export const POST = handler({ auth: "user", rateLimit: limit }, async ({ actor, params }) => supportComplaint(actor, params.id));
export const DELETE = handler({ auth: "user", rateLimit: limit }, async ({ actor, params }) => unsupportComplaint(actor, params.id));
