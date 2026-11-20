// Minimal structured logger that redacts personal data and secrets.
const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie|api[-_]?key/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE = /\b(\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}\b/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (typeof value === "string") return value.replace(EMAIL, "$1***@$2").replace(PHONE, "[phone]");
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
    );
  }
  return value;
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: unknown) {
  const line = JSON.stringify({ level, msg, ...(meta ? { meta: redact(meta) } : {}), at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
