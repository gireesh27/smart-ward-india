import { handler } from "@/lib/api";
import { announcementSchema } from "@/lib/validation";
import { createAnnouncement } from "@/lib/services/content";

export const POST = handler({ auth: "admin", body: announcementSchema }, async ({ actor, body, ip }) => createAnnouncement(actor, body, ip));
