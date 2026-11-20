// Human-friendly complaint references, e.g. SWI-2611-7K3QX9.
// Crockford alphabet avoids look-alike characters (I, L, O, U).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function makeReference(date: Date, randomBytes: Uint8Array): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomBytes[i % randomBytes.length] % 32];
  return `SWI-${yy}${mm}-${suffix}`;
}

export const REFERENCE_PATTERN = /^SWI-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/;
