export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));
export const fmt1 = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const fmtPct = (n: number | null | undefined, digits = 0) => (n == null ? "—" : `${n.toFixed(digits)}%`);
export const fmtSigned = (n: number | null | undefined, suffix = "") => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 1 })}${suffix}`);

export function fmtINR(v: number | string | { toString(): string } | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v.toString());
  if (n >= 1e7) return `₹${(n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const TZ = "Asia/Kolkata";
export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—";
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";

export function fmtRelative(d: Date | string, now = new Date()): string {
  const s = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function toDateInput(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

/** Drop blank values from submitted GET filters so schemas treat them as "not set". */
export function cleanParams<T extends Record<string, string | string[] | undefined>>(o: T): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v !== "")) as Record<string, string>;
}
