import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";

/** Post-login landing: administrators go to the admin dashboard, everyone else to the citizen portal. */
export default async function Go() {
  const actor = await requireActor("/go");
  redirect(actor.isAdmin ? "/admin" : "/portal");
}
