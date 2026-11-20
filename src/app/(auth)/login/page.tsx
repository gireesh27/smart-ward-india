import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; reason?: string; reset?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getActor()) redirect(next);
  return (
    <>
      <h1 className="text-2xl font-bold">Sign in</h1>
      {searchParams.reason === "report" && <p className="mt-2 rounded-md bg-saffron-100 px-3 py-2 text-sm">Your report is saved on this device. Sign in or create an account to submit it.</p>}
      {searchParams.reset === "1" && <p className="mt-2 rounded-md bg-leaf-100 px-3 py-2 text-sm text-leaf-700">Password updated. Sign in with your new password.</p>}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">New here? <Link className="link" href={`/register?next=${encodeURIComponent(next)}`}>Create a citizen account</Link></p>
    </>
  );
}
