"use client";
import { useRouter } from "next/navigation";

const short = (name: string) => name.replace(/ (Municipal Corporation|Municipality|Mandal|Nagar Panchayat)$/, "");

/** "Ward No. 12 ▾" pill on the landing dashboard preview. */
export function WardSwitcher({ wards, value }: { wards: Array<{ id: string; number: number; localBody: string }>; value: string }) {
  const router = useRouter();
  return (
    <label className="relative min-w-0 max-w-full">
      <span className="sr-only">Choose ward for the dashboard preview</span>
      <select value={value} onChange={(e) => router.push(`/?ward=${e.target.value}#ward-dashboard`, { scroll: false })}
        className="w-full max-w-[17rem] cursor-pointer appearance-none truncate rounded-full bg-white/15 py-1 pl-3 pr-8 text-[13px] font-medium text-white outline-none ring-1 ring-white/30 focus-visible:ring-2 focus-visible:ring-saffron-500">
        {wards.map((w) => <option key={w.id} value={w.id} className="bg-surface text-ink-900">Ward No. {w.number}, {short(w.localBody)}</option>)}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white">▼</span>
    </label>
  );
}
