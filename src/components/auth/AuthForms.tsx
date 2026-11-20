"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loadDraft } from "@/components/client/draft";

const box = "mt-6 space-y-4";
const Err = ({ msg }: { msg: string | null }) => (msg ? <p role="alert" className="rounded-md bg-alert-100 px-3 py-2 text-sm font-medium text-alert-600">{msg}</p> : null);

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    setPending(true); setError(null); setUnverified(null);
    const { error } = await authClient.signIn.email({ email, password: String(fd.get("password") ?? "") });
    setPending(false);
    if (error) {
      if (error.status === 403) { setUnverified(email); return; }
      setError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={box}>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="email" required /></div>
      <div>
        <div className="flex justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot-password" className="text-sm link">Forgot password?</Link></div>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <Err msg={error} />
      {unverified && (
        <div role="alert" className="rounded-md bg-saffron-100 px-3 py-2 text-sm">
          Verify your email before signing in. <ResendVerification email={unverified} inline />
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (name.length < 2) return setError("Enter your name.");
    if (password.length < 10) return setError("Use a password of at least 10 characters.");
    if (password !== fd.get("confirm")) return setError("The two passwords do not match.");
    if (!fd.get("terms")) return setError("Accept the terms of use to continue.");
    setPending(true); setError(null);
    // Public sign-up always creates a CITIZEN account; role is never accepted from the client.
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/verify-email" });
    setPending(false);
    if (error) {
      setError(error.status === 422 || error.code === "USER_ALREADY_EXISTS" ? "An account with this email may already exist. Try signing in or resetting your password." : error.message ?? "Could not create the account.");
      return;
    }
    try { sessionStorage.setItem("sw-next", next); } catch { /* ignore */ }
    router.push(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={submit} className={box}>
      <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" className="input" autoComplete="name" required maxLength={80} /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="email" required /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" /><p id="pw-hint" className="hint">At least 10 characters.</p></div>
      <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" className="mt-1" required /><span>I accept the <Link className="link" href="/terms">terms of use</Link> and <Link className="link" href="/privacy">privacy policy</Link>.</span></label>
      <Err msg={error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function ResendVerification({ email, inline = false }: { email: string; inline?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email" });
    setState(error ? "error" : "sent");
  }
  const label = state === "sent" ? "Sent — check your inbox." : state === "error" ? "Could not send. Try again shortly." : state === "sending" ? "Sending…" : "Resend verification email";
  return <button type="button" onClick={send} disabled={state === "sending" || state === "sent"} className={inline ? "link" : "btn-outline mt-6"}>{label}</button>;
}

export function ContinueAfterVerify({ signedIn }: { signedIn: boolean }) {
  const [hasDraft, setHasDraft] = useState(false);
  const [next, setNext] = useState("/go");
  useEffect(() => {
    loadDraft().then((d) => setHasDraft(!!d && (!!d.fields.title || !!d.fields.wardId || d.files.length > 0)));
    try { const n = sessionStorage.getItem("sw-next"); if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n); } catch { /* ignore */ }
  }, []);
  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(hasDraft ? "/portal/report" : next)}`} className="btn-primary mt-6">Sign in</Link>;
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {hasDraft && <Link href="/portal/report" className="btn-primary">Finish your report</Link>}
      <Link href={next} className={hasDraft ? "btn-outline" : "btn-primary"}>Continue</Link>
    </div>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await authClient.forgetPassword({ email: String(new FormData(e.currentTarget).get("email") ?? "").trim(), redirectTo: "/reset-password" });
    setPending(false);
    setDone(true); // Same message whether or not the account exists (no account enumeration).
  }
  if (done) return <p role="status" className="mt-6 rounded-md bg-leaf-100 px-3 py-3 text-sm text-leaf-700">If an account exists for that email, a reset link is on its way.</p>;
  return (
    <form onSubmit={submit} className={box}>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="email" required /></div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? "");
    if (pw.length < 10) return setError("Use a password of at least 10 characters.");
    if (pw !== fd.get("confirm")) return setError("The two passwords do not match.");
    setPending(true); setError(null);
    const { error } = await authClient.resetPassword({ newPassword: pw, token });
    setPending(false);
    if (error) return setError("This link has expired or was already used. Request a new one.");
    router.push("/login?reset=1");
  }
  return (
    <form onSubmit={submit} className={box}>
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required /></div>
      <div><label className="label" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required /></div>
      <Err msg={error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get("newPassword") ?? "");
    if (next.length < 10) return setMsg({ ok: false, text: "Use at least 10 characters." });
    if (next !== fd.get("confirm")) return setMsg({ ok: false, text: "The new passwords do not match." });
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: String(fd.get("currentPassword") ?? ""), newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) return setMsg({ ok: false, text: "Current password is incorrect." });
    form.reset();
    setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label" htmlFor="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" minLength={10} required /></div>
      <div><label className="label" htmlFor="confirm-new">Confirm new password</label><input id="confirm-new" name="confirm" type="password" className="input" autoComplete="new-password" required /></div>
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-leaf-700" : "text-alert-600"}`}>{msg.text}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
