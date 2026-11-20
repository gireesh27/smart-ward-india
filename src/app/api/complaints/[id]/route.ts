import { handler } from "@/lib/api";
import { getComplaintForActor } from "@/lib/services/complaints";

export const GET = handler({ auth: "user" }, async ({ actor, params }) => getComplaintForActor(actor, params.id));
