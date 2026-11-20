// Upload validation by content signature, never by client-provided type or name.

export type AllowedMime =
  | "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
  | "video/mp4" | "video/webm" | "video/quicktime";
export type UploadPurpose = "COMPLAINT" | "COMMENT" | "RESOLUTION" | "PROJECT_PHOTO" | "PROJECT_DOCUMENT";

const IMAGES: AllowedMime[] = ["image/jpeg", "image/png", "image/webp"];
const VIDEOS: AllowedMime[] = ["video/mp4", "video/webm", "video/quicktime"];

export const PURPOSE_MIME: Record<UploadPurpose, AllowedMime[]> = {
  COMPLAINT: [...IMAGES, ...VIDEOS],
  COMMENT: [...IMAGES, ...VIDEOS],
  RESOLUTION: [...IMAGES, ...VIDEOS, "application/pdf"],
  PROJECT_PHOTO: [...IMAGES],
  PROJECT_DOCUMENT: ["application/pdf", "image/jpeg", "image/png"],
};

export const EXTENSION: Record<AllowedMime, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

export const isVideo = (mime: string) => mime.startsWith("video/");

// ISO base-media brands that are genuinely video. HEIC/AVIF images share the
// container but use other brands, so they are not mistaken for video.
const MP4_BRANDS = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV", "3gp4", "3gp5", "3gp6", "3g2a", "dash"];

export function detectMime(b: Uint8Array): AllowedMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "qt  ") return "video/quicktime";
    if (MP4_BRANDS.includes(brand)) return "video/mp4";
    return null;
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.normalize("NFKC").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 120);
}

export type FileCheck = { ok: true; mime: AllowedMime } | { ok: false; message: string };

/** Images/documents are limited to maxBytes; videos to maxVideoBytes (defaults to maxBytes). */
export function validateUpload(bytes: Uint8Array, purpose: UploadPurpose, maxBytes: number, maxVideoBytes: number = maxBytes): FileCheck {
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  const mime = detectMime(bytes);
  if (!mime || !PURPOSE_MIME[purpose].includes(mime)) {
    const allowed = [...new Set(PURPOSE_MIME[purpose].map((m) => EXTENSION[m].toUpperCase()))].join(", ");
    return { ok: false, message: `Unsupported file type. Upload ${allowed}.` };
  }
  const limit = isVideo(mime) ? maxVideoBytes : maxBytes;
  if (bytes.length > limit) return { ok: false, message: `${isVideo(mime) ? "Videos" : "Files"} must be ${Math.round(limit / 1048576)} MB or smaller.` };
  return { ok: true, mime };
}
