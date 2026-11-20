import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { projectSchema } from "@/lib/validation";
import { createProject, listProjects } from "@/lib/services/projects";

const q = z.object({ ward: z.string().max(64).optional(), status: z.string().max(20).optional(), category: z.string().max(64).optional(), q: z.string().max(100).optional(), archived: z.enum(["1", "0"]).optional(), page: z.coerce.number().int().min(1).default(1) });

/** Public callers see public, active projects; administrators see projects in scope. */
export const GET = handler({ auth: "public" }, async ({ req, actor }) => {
  const f = parseQuery(req, q);
  return listProjects(actor, { ...f, archived: f.archived === "1" });
});

export const POST = handler({ auth: "admin", body: projectSchema }, async ({ actor, body, ip }) => createProject(actor, body, ip));
