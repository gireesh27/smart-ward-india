import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { userCreateSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/lib/services/users";

const q = z.object({ q: z.string().max(100).optional(), role: z.string().max(20).optional(), page: z.coerce.number().int().min(1).default(1) });
export const GET = handler({ auth: "admin" }, async ({ req, actor }) => listUsers(actor, parseQuery(req, q)));
export const POST = handler({ auth: "admin", body: userCreateSchema, rateLimit: { bucket: "user-create", limit: 20, windowSec: 3600, per: "user" } }, async ({ actor, body, ip }) => createUser(actor, body, ip));
