import { handler } from "@/lib/api";
import { feedbackSchema } from "@/lib/validation";
import { submitFeedback } from "@/lib/services/complaints";

export const POST = handler({ auth: "user", body: feedbackSchema }, async ({ actor, params, body }) => submitFeedback(actor, params.id, body));
