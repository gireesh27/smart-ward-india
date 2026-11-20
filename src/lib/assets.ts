import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Optional, owner-supplied images in public/assets (see docs/ASSETS.md). Returns the public URL of the
 * first file that exists, or null so the caller can fall back to the built-in artwork. Server-only.
 */
export function asset(...candidates: string[]): string | null {
  for (const rel of candidates) {
    if (existsSync(join(process.cwd(), "public", "assets", rel))) return `/assets/${rel}`;
  }
  return null;
}

const IMG = (base: string) => [`${base}.webp`, `${base}.jpg`, `${base}.jpeg`, `${base}.png`];
export const ASSET = {
  logo: () => asset("brand/logo.svg", "brand/logo.png"),
  heroCitizens: () => asset(...IMG("hero/citizens")),
  vision: () => asset(...IMG("landing/vision")),
  partners: () => asset(...IMG("landing/partners")),
  adminSidebar: () => asset(...IMG("admin/sidebar-building")),
};
