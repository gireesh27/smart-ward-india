import Link from "next/link";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Choose a new password" };

export default function ResetPage({ searchParams }: { searchParams: { token?: string; error?: string; welcome?: string } }) {
  if (!searchParams.token || searchParams.error) {
    return (
      <>
        <h1 className="text-2xl font-bold">This link is no longer valid</h1>
        <p className="mt-2 text-sm">Password links work once and expire after 30 minutes.</p>
        <Link href="/forgot-password" className="btn-primary mt-6">Send a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">{searchParams.welcome ? "Set up your password" : "Choose a new password"}</h1>
      {searchParams.welcome && <p className="mt-1 text-sm text-ink-500">An administrator created your account. Choose a password to finish setting it up.</p>}
      <ResetForm token={searchParams.token} />
    </>
  );
}
