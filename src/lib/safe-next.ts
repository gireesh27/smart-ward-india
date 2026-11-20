/** Only allow same-site relative redirects ("/path"), never "//host" or absolute URLs. */
export function safeNext(next: string | null | undefined, fallback = "/go"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
