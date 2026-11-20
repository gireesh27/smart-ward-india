import { handler, parseQuery } from "@/lib/api";
import { complaintCreateSchema, complaintListSchema } from "@/lib/validation";
import { createComplaint, listComplaints } from "@/lib/services/complaints";

/** Citizens see their own complaints; administrators see complaints in their scope. */
export const GET = handler({ auth: "user" }, async ({ req, actor }) => listComplaints(actor, parseQuery(req, complaintListSchema)));

export const POST = handler(
  { auth: "user", body: complaintCreateSchema, rateLimit: { bucket: "complaint-create", limit: 10, windowSec: 3600, per: "user" } },
  async ({ actor, body }) => createComplaint(actor, body),
);
