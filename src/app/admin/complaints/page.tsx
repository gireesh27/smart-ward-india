import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { listComplaints } from "@/lib/services/complaints";
import { geoPathFor } from "@/lib/services/geo";
import { GeoPicker } from "@/components/client/GeoPicker";
import { complaintListSchema } from "@/lib/validation";
import { COMPLAINT_STATUSES, STATUS_LABELS, isOverdue, type Status } from "@/lib/domain/status";
import { cleanParams, fmtDate } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { EmptyState, Pagination, PriorityBadge, StatusBadge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client/AutoSubmit";
import { FilterChips, SortHeader } from "@/components/data/TableControls";

export const metadata = { title: "Citizen complaints" };

export default async function ComplaintQueue({ searchParams }: { searchParams: Record<string, string> }) {
  const actor = await requireAdminPage("/admin/complaints");
  const parsed = complaintListSchema.safeParse(cleanParams(searchParams));
  const q = parsed.success ? parsed.data : complaintListSchema.parse({});
  const [res, categories, path] = await Promise.all([listComplaints(actor, q), prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), geoPathFor({ wardId: q.ward, localBodyId: q.localBody, districtId: q.district })]);
  const clean = Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v));
  const href = (p: number) => `?${new URLSearchParams({ ...clean, page: String(p) })}`;
  const exportHref = `/api/reports/export?${new URLSearchParams({ type: "complaints", format: "csv", ...(q.sort ? { sort: q.sort } : {}), ...(q.ward ? { ward: q.ward } : {}), ...(q.localBody ? { localBody: q.localBody } : {}), ...(q.district ? { district: q.district } : {}), ...(q.category ? { category: q.category } : {}), ...(typeof q.status === "string" ? { status: q.status } : {}) })}`;
  return (
    <>
      <AdminTopBar actor={actor} title="Citizen Complaints" subtitle={`${res.total} complaint${res.total === 1 ? "" : "s"} in your area`} />
      <div className="admin-panel p-4">
        <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Filter complaints">
          <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={q.q} className="input w-56" placeholder="Reference, title, address" /></div>
          <div><label className="label" htmlFor="status">Status</label><AutoSubmitSelect id="status" name="status" defaultValue={searchParams.status ?? ""} className="select w-44"><option value="">All</option><option value="open">All open</option><option value="done">Resolved / closed</option>{COMPLAINT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</AutoSubmitSelect></div>
          <div><label className="label" htmlFor="category">Category</label><AutoSubmitSelect id="category" name="category" defaultValue={q.category ?? ""} className="select w-40"><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect></div>
          <div className="w-full"><GeoPicker defaultValue={path} names={{ district: "district", localBody: "localBody", ward: "ward" }} scoped autoSubmit variant="compact" idPrefix="cq" className="grid gap-2 sm:grid-cols-4 sm:space-y-0" /></div>
          <div><label className="label" htmlFor="priority">Priority</label><AutoSubmitSelect id="priority" name="priority" defaultValue={q.priority ?? ""} className="select w-32"><option value="">All</option>{["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}</AutoSubmitSelect></div>
          <div><label className="label" htmlFor="sort">Sort</label><AutoSubmitSelect id="sort" name="sort" defaultValue={q.sort} className="select w-36"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="priority">Priority</option><option value="due">Due soonest</option><option value="support">Most supported</option></AutoSubmitSelect></div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={q.overdue === "1"} />Overdue only</label>
          <button className="btn-primary">Apply</button>
          <a href={exportHref} className="btn-outline ml-auto">Export CSV</a>
        </form>
        <div className="px-3 pb-3"><FilterChips base="/admin/complaints" params={clean} chips={[
          ...(q.status ? [{ key: "status", label: "Status", value: q.status.split(",").map((x) => (x === "open" ? "All open" : x === "done" ? "Resolved or closed" : STATUS_LABELS[x as keyof typeof STATUS_LABELS] ?? x)).join(", ") }] : []),
          ...(q.category ? [{ key: "category", label: "Category", value: categories.find((c) => c.id === q.category)?.name ?? "Selected" }] : []),
          ...(q.priority ? [{ key: "priority", label: "Priority", value: q.priority.toLowerCase() }] : []),
          ...(path.district && q.district ? [{ key: "district", label: "District", value: path.district.name, clears: ["localBody", "ward"] }] : []),
          ...(path.localBody && q.localBody ? [{ key: "localBody", label: "Area", value: path.localBody.name, clears: ["ward"] }] : []),
          ...(path.ward && q.ward ? [{ key: "ward", label: "Ward", value: `Ward ${path.ward.number}` }] : []),
          ...(q.q ? [{ key: "q", label: "Search", value: q.q }] : []),
        ]} /></div>
      </div>
      <div className="admin-panel mt-4 overflow-x-auto">
        {res.items.length === 0 ? <div className="p-4"><EmptyState title="No complaints match these filters" action={<Link href="/admin/complaints" className="btn-outline">Clear filters</Link>} /></div> : (
          <table className="table min-w-[980px]">
            <caption className="sr-only">Complaint queue</caption>
            <thead><tr>{([["Reference", "reference", "asc"], ["Title", "title", "asc"], ["Ward", "ward", "asc"], ["Category", "category", "asc"], ["Status", "status", "asc"], ["Priority", "priority", "desc"], ["Support", "support", "desc"]] as const).map(([label, field, dir]) => <SortHeader key={field} label={label} field={field} firstDir={dir} current={q.sort} base="/admin/complaints" params={clean} />)}<th scope="col">Assigned to</th><SortHeader label="Due" field="due" current={q.sort} base="/admin/complaints" params={clean} /></tr></thead>
            <tbody>{res.items.map((c) => {
              const late = isOverdue(c.status as Status, c.dueAt);
              return (
                <tr key={c.id} className={late ? "bg-alert-100/40" : undefined}>
                  <td className="whitespace-nowrap"><Link className="link" href={`/admin/complaints/${c.id}`}>{c.reference}</Link></td>
                  <td className="max-w-[280px]"><span className="line-clamp-2">{c.title}</span><span className="text-xs text-ink-500">{fmtDate(c.createdAt)}{c._count.attachments ? `, ${c._count.attachments} ${c._count.attachments === 1 ? "file" : "files"}` : ""}</span></td>
                  <td className="whitespace-nowrap">Ward {c.ward.number}<span className="block text-xs text-ink-500">{c.ward.localBody.name}</span></td>
                  <td>{c.category.name}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><PriorityBadge priority={c.priority} /></td>
                  <td className="tabular-nums">{c.isPublic ? c.supportCount : <span className="text-xs text-ink-500">private</span>}</td>
                  <td className="text-xs">{c.department?.name ?? <span className="text-ink-500">Unassigned</span>}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(c.dueAt)}{late && <span className="mt-0.5 block font-semibold text-alert-600">Overdue</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      <div className="[&_*]:text-white"><Pagination page={res.page} pages={res.pages} href={href} /></div>
    </>
  );
}
