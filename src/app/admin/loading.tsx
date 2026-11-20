// Shown instantly while the page loads its data, so navigation never looks frozen.
export default function Loading() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 md:px-8" aria-busy="true">
      <p className="sr-only" role="status">Loading…</p>
      <div className="h-8 w-72 max-w-full rounded-md bg-track motion-safe:animate-pulse" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-track/70 motion-safe:animate-pulse" />)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]"><div className="h-[420px] rounded-xl bg-track/60 motion-safe:animate-pulse" /><div className="h-[420px] rounded-xl bg-track/60 motion-safe:animate-pulse" /></div>
    </div>
  );
}
