import { handler } from "@/lib/api";
import { projectSchema } from "@/lib/validation";
import { getProject, updateProject } from "@/lib/services/projects";

export const GET = handler({ auth: "public" }, async ({ actor, params }) => getProject(actor, params.id));
export const PUT = handler({ auth: "admin", body: projectSchema }, async ({ actor, params, body, ip }) => updateProject(actor, params.id, body, ip));
