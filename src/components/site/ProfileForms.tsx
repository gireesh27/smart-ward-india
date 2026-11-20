import type { GeoPath } from "@/lib/geo-types";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { GeoPicker } from "@/components/client/GeoPicker";
import { ChangePasswordForm } from "@/components/auth/AuthForms";
import { ThemeToggle } from "@/components/client/ThemeToggle";

type U = { name: string; email: string; phone: string | null; wardId: string | null; notifyEmail: boolean; notifyInApp: boolean };

export function ProfileForm({ user, path }: { user: U; path: GeoPath }) {
  return (
    <ApiForm action="/api/profile" method="PATCH" booleans={["notifyEmail", "notifyInApp"]} successMessage="Profile saved." className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="p-name">Name</label><input id="p-name" name="name" className="input" defaultValue={user.name} required /><FieldError name="name" /></div>
        <div><label className="label" htmlFor="p-email">Email</label><input id="p-email" className="input" value={user.email} readOnly disabled /><p className="hint">Contact support to change your email.</p></div>
        <div><label className="label" htmlFor="p-phone">Phone <span className="font-normal text-ink-500">(optional)</span></label><input id="p-phone" name="phone" className="input" defaultValue={user.phone ?? ""} autoComplete="tel" /><FieldError name="phone" /></div>
      </div>
      <fieldset><legend className="label">Home ward</legend><GeoPicker defaultValue={path} names={{ ward: "wardId" }} idPrefix="profile" villageSearch /></fieldset>
      <fieldset className="space-y-2"><legend className="label">Notifications</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notifyInApp" defaultChecked={user.notifyInApp} />In-app notifications</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notifyEmail" defaultChecked={user.notifyEmail} />Email updates about my complaints</label>
      </fieldset>
      <SubmitButton>Save profile</SubmitButton>
    </ApiForm>
  );
}

export { ChangePasswordForm };

/** Theme choice for signed-in users (the header toggle is shown only to visitors). Saved on this device. */
export function AppearanceSettings() {
  return (
    <section aria-labelledby="appearance-title" className="mt-6 border-t border-line pt-5">
      <h3 id="appearance-title" className="text-base font-semibold text-ink-900">Appearance</h3>
      <p className="mt-1 text-sm text-ink-700">Light is the default. Choose dark, or follow your device setting. Saved on this device.</p>
      <ThemeToggle className="mt-3" />
    </section>
  );
}
