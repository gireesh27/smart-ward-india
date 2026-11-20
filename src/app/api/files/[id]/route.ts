import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { actorFromHeaders } from "@/lib/session";
import { notFound } from "@/lib/errors";
import { readableAttachment } from "@/lib/services/attachments";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Parse a single "bytes=start-end" range against a known size. Returns null when absent/unsupported. */
function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number, end: number;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: last N bytes
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

/** Streams a stored file after checking the caller may read it. Never exposes storage URLs. Supports byte ranges for video. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await actorFromHeaders(req.headers);
    const att = await readableAttachment(actor, params.id);
    if (!att) throw notFound("File");
    const range = parseRange(req.headers.get("range"), att.size);
    if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${att.size}` } });

    const obj = await getObject(att.storageKey, range ?? undefined);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const name = att.fileName.replace(/"/g, "");
    const headers: Record<string, string> = {
      "Content-Type": att.mimeType,
      "Content-Length": String(range ? range.end - range.start + 1 : obj.length ?? att.size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": att.isPublic ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    };
    if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${att.size}`;
    return new Response(obj.stream, { status: range ? 206 : 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
