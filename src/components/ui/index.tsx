import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { STATUS_LABELS, type Status } from "@/lib/domain/status";

export function Card({ title, icon, action, children, className, bodyClassName, variant = "public", id }: {
  title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; variant?: "public" | "admin"; id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={cn(variant === "admin" ? "admin-panel" : "card", "flex flex-col", className)} aria-labelledby={headingId}>
      {title && (
        <div className={variant === "admin" ? "card-head-admin" : "card-head"}>
          {icon}
          <h2 id={headingId} className="min-w-0 flex-[1_1_12rem] font-display text-[17px] font-semibold leading-snug text-white">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn("flex-1", bodyClassName ?? "card-body")}>{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  SUBMITTED: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  ASSIGNED: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  CLOSED: "bg-muted text-ink-700",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  DUPLICATE: "bg-muted text-ink-500",
  REOPEN_REQUESTED: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  REOPENED: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("badge", STATUS_STYLE[status as Status] ?? "bg-muted")}>{STATUS_LABELS[status as Status] ?? status}</span>;
}

const PRIORITY_STYLE: Record<string, string> = { LOW: "bg-muted text-ink-700", MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200", HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200", URGENT: "bg-rose-600 text-white" };
export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={cn("badge", PRIORITY_STYLE[priority])}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}

export function BandDot({ band }: { band: string }) {
  const color = band === "Excellent" || band === "Good" ? "bg-leaf-500" : band === "Needs Attention" ? "bg-saffron-500" : band === "Critical" ? "bg-alert-600" : "bg-track";
  return <span className="inline-flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", color)} aria-hidden="true" />{band}</span>;
}

export function ProgressBar({ value, color = "#22a04b", label, className }: { value: number | null; color?: string; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-track", className)} role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink-900">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
      {page > 1 ? <Link className="btn-outline btn-sm" href={href(page - 1)} rel="prev">Previous</Link> : <span />}
      <span className="text-ink-500">Page {page} of {pages}</span>
      {page < pages ? <Link className="btn-outline btn-sm" href={href(page + 1)} rel="next">Next</Link> : <span />}
    </nav>
  );
}

export function Donut({ value, size = 150, stroke = 16, color = "#41c03b", track = "rgb(var(--track))", children, label }: {
  value: number | null; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: track }} />
        {value != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Multi-segment donut for category distribution; segments are listed in an accessible legend nearby. */
export function SegmentDonut({ items, size = 170, stroke = 34, children }: { items: Array<{ name: string; count: number; color: string }>; size?: number; stroke?: number; children?: ReactNode }) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "rgb(var(--track))" }} />
        {items.map((it) => {
          const len = (it.count / total) * c;
          const el = <circle key={it.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Change({ value, suffix = "%", label = "vs last month", invert = false, tone = "dark" }: { value: number | null; suffix?: string; label?: string; invert?: boolean; tone?: "dark" | "light" }) {
  if (value == null) return <span className={cn("text-xs", tone === "light" ? "text-white/75" : "text-ink-500")}>No comparison data</span>;
  const good = invert ? value <= 0 : value >= 0;
  const color = tone === "light" ? (good ? "text-[#b6ffb0]" : "text-[#ffd0d0]") : good ? "text-leaf-700" : "text-alert-600";
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", color)}>
      <span aria-hidden="true">{value >= 0 ? "↑" : "↓"}</span>
      <span>{value > 0 ? "+" : value < 0 ? "−" : ""}{Math.abs(value)}{suffix}</span>
      <span className={cn("font-normal", tone === "light" ? "text-white/85" : "text-ink-500")}>{label}</span>
    </span>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy-700 md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DemoNotice({ className }: { className?: string }) {
  return <p className={cn("text-xs text-ink-500", className)}>Independent demonstration platform with synthetic data. Not affiliated with any government body.</p>;
}
