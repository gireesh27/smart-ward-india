"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error.digest ?? error.message); }, [error]);
  return (
    <main id="main" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold text-navy-700">Something went wrong loading this page</h1>
      <p className="text-ink-500">This is usually temporary. Try again; if it keeps happening, check that the database and storage services are running.</p>
      {error.digest && <p className="text-xs text-ink-500">Reference: {error.digest}</p>}
      <button type="button" className="btn-primary" onClick={reset}>Try again</button>
    </main>
  );
}
