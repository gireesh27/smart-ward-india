import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { geoPathFor } from "@/lib/services/geo";
import { ReportForm } from "@/components/client/ReportForm";

export const metadata = { title: "Report a problem", description: "Report a water, road, drainage, sanitation, electricity or streetlight problem in your ward, with a photo, and follow it to resolution.", alternates: { canonical: "/report" } };

/** Public entry point: anyone can start a report; signing in is only needed to submit. */
export default async function PublicReportPage() {
  const actor = await getActor();
  const [path, categories] = await Promise.all([
    geoPathFor({ wardId: actor?.wardId }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-navy-700">Report a problem</h1>
      <p className="mb-6 mt-1 text-ink-700">Your report goes to the ward office responsible for the location you choose.</p>
      <div className="card p-5"><ReportForm categories={categories} authenticated={!!actor} defaultPath={path} maxFiles={env().UPLOAD_MAX_FILES} maxBytes={env().UPLOAD_MAX_BYTES} maxVideoBytes={env().UPLOAD_MAX_VIDEO_BYTES} /></div>
    </div>
  );
}
