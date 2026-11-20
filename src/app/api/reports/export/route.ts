import { handler, parseQuery } from "@/lib/api";
import { exportQuerySchema } from "@/lib/validation";
import { buildExport } from "@/lib/services/reports";

/** GET /api/reports/export?type=complaints|wards|projects&format=csv|pdf&… → file download (scope-limited). */
export const GET = handler(
  { auth: "admin", rateLimit: { bucket: "export", limit: 20, windowSec: 600, per: "user" } },
  async ({ req, actor, ip }) => {
    const out = await buildExport(actor, parseQuery(req, exportQuerySchema), ip);
    return new Response(typeof out.body === "string" ? out.body : new Uint8Array(out.body), {
      headers: { "Content-Type": out.contentType, "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "no-store" },
    });
  },
);
