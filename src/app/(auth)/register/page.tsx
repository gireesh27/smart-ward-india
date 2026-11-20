import Link from "next/link";
import { safeNext } from "@/lib/safe-next";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  return (
    <>
      <h1 className="text-2xl font-bold">Create a citizen account</h1>
      <p className="mt-1 text-sm text-ink-500">Report problems in your ward and follow their resolution.</p>
      <RegisterForm next={next} />
      <p className="mt-6 text-center text-sm">Already registered? <Link className="link" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </>
  );
}
