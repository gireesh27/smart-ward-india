import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-6xl font-bold text-navy-700">404</p>
      <h1 className="text-2xl font-semibold">This page does not exist or you do not have access to it</h1>
      <p className="text-ink-500">Check the address, or go back to a page you can open.</p>
      <div className="mt-2 flex gap-3"><Link href="/" className="btn-primary">Home</Link><Link href="/go" className="btn-outline">My dashboard</Link></div>
    </main>
  );
}
