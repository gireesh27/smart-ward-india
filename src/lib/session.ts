import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";
import { isAdminRole, resolveScope, type Actor } from "./authz";

/** Resolve the signed-in, verified, active user from request headers. */
export async function actorFromHeaders(h: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { scopes: true } });
  if (!user || !user.isActive || !user.emailVerified) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    wardId: user.wardId,
    isAdmin: isAdminRole(user.role),
    scope: await resolveScope(user.role, user.scopes),
  };
}

/** Per-request memoised actor for server components. */
export const getActor = cache(async (): Promise<Actor | null> => actorFromHeaders(headers() as unknown as Headers));

export async function requireActor(next = "/portal"): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(next)}`);
  return actor;
}

export async function requireCitizenArea(next = "/portal"): Promise<Actor> {
  return requireActor(next);
}

export async function requireAdminPage(next = "/admin"): Promise<Actor> {
  const actor = await requireActor(next);
  if (!actor.isAdmin) redirect("/portal?notice=admin-only");
  return actor;
}
