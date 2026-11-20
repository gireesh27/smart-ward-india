import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { geoPathFor } from "@/lib/services/geo";
import { Card, PageTitle } from "@/components/ui";
import { AppearanceSettings, ChangePasswordForm, ProfileForm } from "@/components/site/ProfileForms";
import { ROLE_LABEL } from "@/lib/authz";

export const metadata = { title: "Profile & security" };

export default async function Profile() {
  const actor = await requireActor("/portal/profile");
  const [user] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true, email: true, phone: true, wardId: true, notifyEmail: true, notifyInApp: true, role: true } })]);
  const path = await geoPathFor({ wardId: user.wardId });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="Profile & security" subtitle={`Account type: ${ROLE_LABEL[user.role]}`} />
      <Card title="Profile"><ProfileForm user={user} path={path} /><AppearanceSettings /></Card>
      <Card title="Change password"><ChangePasswordForm /></Card>
    </div>
  );
}
