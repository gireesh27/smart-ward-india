import { handler } from "@/lib/api";
import { meetingSchema } from "@/lib/validation";
import { createMeeting, listMeetings } from "@/lib/services/meetings";

export const GET = handler({ auth: "admin" }, async ({ actor }) => listMeetings(actor));
export const POST = handler({ auth: "admin", body: meetingSchema }, async ({ actor, body, ip }) => createMeeting(actor, body, ip));
