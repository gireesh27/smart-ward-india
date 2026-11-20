import { z } from "zod";
import { handler } from "@/lib/api";
import { getMeeting, updateMeeting } from "@/lib/services/meetings";

export const GET = handler({ auth: "admin" }, async ({ actor, params }) => getMeeting(actor, params.id));
const patch = z.object({ status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(), minutes: z.string().trim().max(8000).optional() });
export const PATCH = handler({ auth: "admin", body: patch }, async ({ actor, params, body, ip }) => updateMeeting(actor, params.id, body, ip));
