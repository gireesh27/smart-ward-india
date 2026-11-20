import { describe, expect, it } from "vitest";
import { detectMime, sanitizeFileName, validateUpload } from "@/lib/domain/files";
import { csvCell, toCsv } from "@/lib/domain/csv";
import { makeReference, REFERENCE_PATTERN } from "@/lib/domain/reference";
import { renderTablePdf, pdfSafe } from "@/lib/pdf";

describe("uploads", () => {
  it("detects types from content, not names", () => {
    expect(detectMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rejects empty, oversized and disallowed files", () => {
    expect(validateUpload(new Uint8Array(), "COMPLAINT", 10).ok).toBe(false);
    expect(validateUpload(new Uint8Array(20).fill(0xff), "COMPLAINT", 10).ok).toBe(false);
    expect(validateUpload(new TextEncoder().encode("%PDF-1.7"), "COMPLAINT", 100).ok).toBe(false);
    expect(validateUpload(new TextEncoder().encode("%PDF-1.7"), "PROJECT_DOCUMENT", 100).ok).toBe(true);
  });
  it("accepts MP4/MOV/WebM video with its own size limit, but not HEIC or video project photos", () => {
    const box = (brand: string) => new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0))]);
    expect(detectMime(box("isom"))).toBe("video/mp4");
    expect(detectMime(box("qt  "))).toBe("video/quicktime");
    expect(detectMime(box("heic"))).toBeNull();
    expect(detectMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe("video/webm");
    const clip = new Uint8Array(3000); clip.set(box("mp42"));
    expect(validateUpload(clip, "COMPLAINT", 1000, 5000).ok).toBe(true);
    expect(validateUpload(clip, "COMPLAINT", 1000, 2000).ok).toBe(false);
    expect(validateUpload(clip, "PROJECT_PHOTO", 1000, 5000).ok).toBe(false);
  });
  it("sanitises file names", () => {
    expect(sanitizeFileName("../../x/<b>.jpg")).toBe("_b_.jpg");
  });
});

describe("csv", () => {
  it("escapes and neutralises formulas", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsv([{ n: 1 }], [{ header: "N", value: (r) => r.n }])).toBe("\uFEFFN\r\n1\r\n");
  });
});

describe("references and pdf", () => {
  it("creates well-formed references", () => {
    expect(makeReference(new Date("2026-11-15T00:00:00Z"), new Uint8Array([9, 8, 7, 6, 5, 4]))).toMatch(REFERENCE_PATTERN);
  });
  it("renders a multi-page PDF and replaces unsupported glyphs", async () => {
    const bytes = await renderTablePdf({ title: "Test ₹ report", subtitle: "x", columns: [{ header: "A" }, { header: "B" }], rows: Array.from({ length: 80 }, (_, i) => [String(i), "తెలుగు"]), generatedBy: "Tester" });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdfSafe("₹5 — ok")).toBe("Rs.5 - ok");
  });
});
