import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { GeoPicker } from "@/components/client/GeoPicker";
import { monthKey } from "@/lib/domain/period";
import { fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Reports & analytics" };

export default async function Reports() {
  const actor = await requireAdminPage("/admin/reports");
  const [categories, history] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.reportExport.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <>
      <AdminTopBar actor={actor} title="Reports & Analytics" subtitle="Exports are limited to the wards you administer and exclude reporter identities" />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card variant="admin" title="Generate a report">
          <form method="get" action="/api/reports/export" className="grid gap-3 md:grid-cols-3">
            <div><label className="label" htmlFor="type">Report</label><select id="type" name="type" className="select"><option value="complaints">Complaints</option><option value="wards">Ward performance</option><option value="projects">Development projects</option></select></div>
            <div><label className="label" htmlFor="format">Format</label><select id="format" name="format" className="select"><option value="csv">CSV (spreadsheet)</option><option value="pdf">PDF</option></select></div>
            <div><label className="label" htmlFor="month">Month (ward report)</label><input id="month" name="month" type="month" className="input" defaultValue={monthKey(new Date())} /></div>
            <fieldset className="md:col-span-3"><legend className="label">Area <span className="font-normal text-ink-500">(leave empty for everything in your scope)</span></legend><GeoPicker names={{ district: "district", localBody: "localBody", ward: "ward" }} scoped idPrefix="rp" className="grid gap-3 sm:grid-cols-4" /></fieldset>

            <div><label className="label" htmlFor="category">Category</label><select id="category" name="category" className="select"><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label" htmlFor="status">Status (complaints)</label><select id="status" name="status" className="select"><option value="">All</option><option value="open">Open</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option><option value="REJECTED">Rejected</option></select></div>
            <div><label className="label" htmlFor="from">From</label><input id="from" name="from" type="date" className="input" /></div>
            <div><label className="label" htmlFor="to">To</label><input id="to" name="to" type="date" className="input" /></div>
            <div className="md:col-span-3"><button type="submit" className="btn-green">Download report</button><p className="hint">Empty filters are ignored. Downloads are recorded in your export history and the audit log.</p></div>
          </form>
        </Card>
        <Card variant="admin" title="Your recent exports">
          {history.length === 0 ? <EmptyState title="No exports yet" /> : (
            <table className="table text-[13px]"><thead><tr><th scope="col">When</th><th scope="col">Report</th><th scope="col">Rows</th></tr></thead>
              <tbody>{history.map((h) => <tr key={h.id}><td>{fmtDateTime(h.createdAt)}</td><td>{h.type.toLowerCase()} ({h.format})</td><td>{h.rowCount}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </>
  );
}
