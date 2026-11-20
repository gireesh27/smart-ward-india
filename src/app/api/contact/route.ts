import { handler } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { createInquiry } from "@/lib/services/content";

export const POST = handler(
  { auth: "public", body: contactSchema, rateLimit: { bucket: "contact", limit: 5, windowSec: 3600 } },
  async ({ body }) => createInquiry(body),
);
