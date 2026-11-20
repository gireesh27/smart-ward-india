// Calendar helpers. All periods are UTC months, stored as the first day.

export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function parseMonthKey(key: string | null | undefined, fallback: Date = new Date()): Date {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key ?? "");
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : monthStart(fallback);
}
export function monthLabel(d: Date, style: "short" | "long" = "short"): string {
  return d.toLocaleString("en-IN", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });
}
/** [start, end) of a month and of the month before it. */
export function monthWindow(month: Date): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const start = monthStart(month);
  return { start, end: addMonths(start, 1), prevStart: addMonths(start, -1), prevEnd: start };
}
export function lastNMonths(end: Date, n: number): Date[] {
  const s = monthStart(end);
  return Array.from({ length: n }, (_, i) => addMonths(s, i - n + 1));
}
