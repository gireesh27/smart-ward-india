import { handler } from "@/lib/api";
import { milestoneSchema, milestoneUpdateSchema } from "@/lib/validation";
import { addMilestone, toggleMilestone } from "@/lib/services/projects";

export const POST = handler({ auth: "admin", body: milestoneSchema }, async ({ actor, params, body }) => addMilestone(actor, params.id, body));
export const PATCH = handler({ auth: "admin", body: milestoneUpdateSchema }, async ({ actor, params, body, ip }) => toggleMilestone(actor, params.id, body.milestoneId, body.completed, ip));
