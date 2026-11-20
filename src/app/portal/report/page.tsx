import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireActor } from "@/lib/session";
import { geoPathFor } from "@/lib/services/geo";
import { ReportForm } from "@/components/client/ReportForm";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Report an issue" };

export default async function PortalReport() {
  const actor = await requireActor("/portal/report");
  const [path, categories] = await Promise.all([geoPathFor({ wardId: actor.wardId }), prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } })]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Report an issue" subtitle="Your report goes to the ward office for the location you choose." />
      <div className="card p-5"><ReportForm categories={categories} authenticated defaultPath={path} maxFiles={env().UPLOAD_MAX_FILES} maxBytes={env().UPLOAD_MAX_BYTES} maxVideoBytes={env().UPLOAD_MAX_VIDEO_BYTES} /></div>
    </div>
  );
}
