import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type LgdCoverage = { districts: number; mandals: number; gramPanchayats: number; urbanLocalBodies: number; wards: number; villages: number };

let cache: { path: string; mtime: number; value: LgdCoverage | null } | null = null;

/**
 * Coverage of the installed Local Government Directory data, read from the converter's report.json
 * (no database query, so the landing page stays fast). Null when the report is missing or unreadable.
 * Server-only.
 */
export function lgdCoverage(): LgdCoverage | null {
  const path = join(process.cwd(), process.env.LGD_DATA_DIR ?? "data/lgd/andhra-pradesh", "report.json");
  if (!existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs;
  if (cache && cache.path === path && cache.mtime === mtime) return cache.value;
  let value: LgdCoverage | null = null;
  try {
    const c = (JSON.parse(readFileSync(path, "utf8")) as { counts?: Record<string, unknown> }).counts ?? {};
    const n = (k: string) => (typeof c[k] === "number" ? (c[k] as number) : 0);
    value = n("districts") > 0 ? { districts: n("districts"), mandals: n("subdistricts"), gramPanchayats: n("gramPanchayats"), urbanLocalBodies: n("urbanLocalBodies"), wards: n("wards"), villages: n("villages") } : null;
  } catch {
    value = null;
  }
  cache = { path, mtime, value };
  return value;
}
