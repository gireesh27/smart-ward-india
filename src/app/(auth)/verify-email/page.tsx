import Link from "next/link";
import { getActor } from "@/lib/session";
import { ResendVerification, ContinueAfterVerify } from "@/components/auth/AuthForms";

export const metadata = { title: "Verify email" };

/** Better Auth redirects here after the verification link is opened (with ?error=… on failure). */
export default async function VerifyEmailPage({ searchParams }: { searchParams: { error?: string; sent?: string; email?: string } }) {
  if (searchParams.sent) {
    return (
      <>
        <h1 className="text-2xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm">We sent a verification link{searchParams.email ? <> to <strong>{searchParams.email}</strong></> : null}. Open it within 1 hour to activate your account.</p>
        <p className="mt-2 text-xs text-ink-500">Running locally? Captured emails appear at http://localhost:8025.</p>
        {searchParams.email && <ResendVerification email={searchParams.email} />}
      </>
    );
  }
  if (searchParams.error) {
    return (
      <>
        <h1 className="text-2xl font-bold">We could not verify your email</h1>
        <p className="mt-2 text-sm">The link has expired or was already used. Sign in to request a new one.</p>
        <Link href="/login" className="btn-primary mt-6">Go to sign in</Link>
      </>
    );
  }
  const actor = await getActor();
  return (
    <>
      <h1 className="text-2xl font-bold">Email verified</h1>
      <p className="mt-2 text-sm">{actor ? `Welcome, ${actor.name}. Your account is ready.` : "Your account is ready. Sign in to continue."}</p>
      <ContinueAfterVerify signedIn={!!actor} />
    </>
  );
}
