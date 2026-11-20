// Tabular PDF renderer built on pdf-lib (pure JS, no native deps).
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// Helvetica (WinAnsi) cannot encode most non-Latin glyphs; substitute safely.
export function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > width) t = t.slice(0, -1);
  return t + "...";
}

export async function renderTablePdf(opts: {
  title: string;
  subtitle: string;
  columns: Array<{ header: string; weight?: number }>;
  rows: string[][];
  generatedBy: string;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(opts.title));
  doc.setProducer("Smart Ward India");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 32; // A4 landscape
  const navy = rgb(0, 0.18, 0.39);
  const totalWeight = opts.columns.reduce((s, c) => s + (c.weight ?? 1), 0);
  const widths = opts.columns.map((c) => ((W - 2 * M) * (c.weight ?? 1)) / totalWeight);
  const rowH = 16, size = 8;
  const at = (opts.generatedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 16) + " UTC";

  let page = doc.addPage([W, H]);
  let y = 0;
  const pages: typeof page[] = [];
  const header = (first: boolean) => {
    pages.push(page);
    page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: navy });
    page.drawText("Smart Ward India", { x: M, y: H - 29, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText(fit(opts.title, bold, 11, 420), { x: W - M - Math.min(420, bold.widthOfTextAtSize(pdfSafe(opts.title), 11)), y: H - 28, size: 11, font: bold, color: rgb(1, 1, 1) });
    y = H - 66;
    if (first) {
      page.drawText(fit(opts.subtitle, font, 9, W - 2 * M), { x: M, y, size: 9, font, color: rgb(0.2, 0.25, 0.35) });
      y -= 12;
      page.drawText(pdfSafe(`Generated ${at} by ${opts.generatedBy}. ${opts.rows.length} rows.`), { x: M, y, size: 8, font, color: rgb(0.4, 0.45, 0.55) });
      y -= 16;
    }
    let x = M;
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: rowH, color: rgb(0.86, 0.91, 0.98) });
    opts.columns.forEach((c, i) => { page.drawText(fit(c.header, bold, size, widths[i] - 6), { x: x + 3, y: y + 1, size, font: bold, color: navy }); x += widths[i]; });
    y -= rowH;
  };
  header(true);
  if (opts.rows.length === 0) page.drawText("No records match these filters.", { x: M, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  opts.rows.forEach((r, idx) => {
    if (y < M + 20) { page = doc.addPage([W, H]); header(false); }
    if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: rowH, color: rgb(0.97, 0.98, 1) });
    let x = M;
    r.forEach((cell, i) => { page.drawText(fit(cell ?? "", font, size, widths[i] - 6), { x: x + 3, y: y + 1, size, font, color: rgb(0.1, 0.13, 0.2) }); x += widths[i]; });
    y -= rowH;
  });
  pages.forEach((p, i) => {
    p.drawText(pdfSafe(`Page ${i + 1} of ${pages.length}  |  Independent demonstration platform - figures derived from platform records.`), { x: M, y: 14, size: 7, font, color: rgb(0.45, 0.5, 0.6) });
  });
  return doc.save();
}
