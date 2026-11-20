import { handler } from "@/lib/api";
import { commentSchema } from "@/lib/validation";
import { addComment } from "@/lib/services/complaints";

export const POST = handler(
  { auth: "user", body: commentSchema, rateLimit: { bucket: "comment", limit: 30, windowSec: 600, per: "user" } },
  async ({ actor, params, body }) => addComment(actor, params.id, body),
);
