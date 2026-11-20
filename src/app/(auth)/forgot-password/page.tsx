import Link from "next/link";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-500">Enter your account email. We will send a link that works once and expires in 30 minutes.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link className="link" href="/login">Back to sign in</Link></p>
    </>
  );
}
