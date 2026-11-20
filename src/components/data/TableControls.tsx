import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "@/components/app-icons";
import { cn } from "@/lib/utils";

type Params = Record<string, string | undefined>;
const qs = (params: Params, drop: string[] = [], set: Record<string, string> = {}) => {
  const p = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && !drop.includes(k) && k !== "page") as Array<[string, string]>);
  for (const [k, v] of Object.entries(set)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

/**
 * Sortable column header (server-rendered link, no JavaScript needed). The sort lives in the URL as
 * `field.asc|desc`, so views are shareable and the CSV export uses the same order.
 */
export function SortHeader({ label, field, current, base, params, paramKey = "sort", firstDir = "asc", className }: {
  label: string; field: string; current?: string; base: string; params: Params; paramKey?: string; firstDir?: "asc" | "desc"; className?: string;
}) {
  const [f, d] = (current ?? "").split(".");
  const active = f === field && (d === "asc" || d === "desc");
  const next = active ? (d === "asc" ? "desc" : "asc") : firstDir;
  const ariaSort = active ? (d === "asc" ? "ascending" : "descending") : "none";
  const Icon = active ? (d === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <Link href={`${base}${qs(params, [paramKey], { [paramKey]: `${field}.${next}` })}`} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-700">
        {label}<Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden="true" />
        <span className="sr-only">{active ? `(sorted ${ariaSort}, select to reverse)` : "(select to sort)"}</span>
      </Link>
    </th>
  );
}

/** Active filters as removable chips, plus "Clear all" (keeps the sort order). */
export function FilterChips({ base, params, chips, keep = ["sort", "tab"] }: {
  base: string; params: Params; chips: Array<{ key: string; label: string; value: string; clears?: string[] }>; keep?: string[];
}) {
  if (!chips.length) return null;
  const keepParams = Object.fromEntries(Object.entries(params).filter(([k]) => keep.includes(k)));
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <Link key={c.key} href={`${base}${qs(params, [c.key, ...(c.clears ?? [])])}`} aria-label={`Remove filter ${c.label}: ${c.value}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] transition-colors hover:border-alert-500 hover:text-alert-600">
          <span className="text-ink-500">{c.label}:</span><span className="font-medium text-ink-900">{c.value}</span><X className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ))}
      <Link href={`${base}${qs(keepParams)}`} className="text-[13px] font-semibold text-brand-700 hover:underline">Clear all</Link>
    </div>
  );
}
