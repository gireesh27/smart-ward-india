import Link from "next/link";
import { requireAdminPage } from "@/lib/session";
import { listProjects } from "@/lib/services/projects";
import { geoPathFor } from "@/lib/services/geo";
import { GeoPicker } from "@/components/client/GeoPicker";
import { fmtDate, fmtINR } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { EmptyState, Pagination, ProgressBar } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client/AutoSubmit";
import { FilterChips } from "@/components/data/TableControls";

export const metadata = { title: "Development projects" };

export default async function AdminProjects({ searchParams }: { searchParams: { ward?: string; localBody?: string; district?: string; status?: string; q?: string; archived?: string; page?: string; sort?: string } }) {
  const actor = await requireAdminPage("/admin/projects");
  const [res, path] = await Promise.all([
    listProjects(actor, { sort: searchParams.sort || undefined, ward: searchParams.ward || undefined, localBody: searchParams.localBody || undefined, district: searchParams.district || undefined, status: searchParams.status || undefined, q: searchParams.q || undefined, archived: searchParams.archived === "1", page: Number(searchParams.page) || 1 }),
    geoPathFor({ wardId: searchParams.ward, localBodyId: searchParams.localBody, districtId: searchParams.district }),
  ]);
  const href = (n: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v)), page: String(n) })}`;
  return (
    <>
      <AdminTopBar actor={actor} title="Development Projects" subtitle={`${res.total} ${searchParams.archived === "1" ? "archived" : "active"} project${res.total === 1 ? "" : "s"}`} />
      <div className="admin-panel mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Filter projects">
          <div><label className="label" htmlFor="pq">Search</label><input id="pq" name="q" defaultValue={searchParams.q} className="input w-56" placeholder="Name or code" /></div>
          <GeoPicker defaultValue={path} names={{ district: "district", localBody: "localBody", ward: "ward" }} scoped autoSubmit variant="compact" idPrefix="pw" className="w-full max-w-3xl sm:grid sm:grid-cols-4 sm:gap-2 sm:space-y-0" />
          <div><label className="label" htmlFor="psort">Sort by</label><AutoSubmitSelect id="psort" name="sort" defaultValue={searchParams.sort ?? "updated"} className="select w-44"><option value="updated">Recently updated</option><option value="name.asc">Name (A to Z)</option><option value="progress.desc">Most progress</option><option value="progress.asc">Least progress</option><option value="target.asc">Target date (soonest)</option><option value="budget.desc">Largest budget</option><option value="status.asc">Status</option></AutoSubmitSelect></div>
          <div><label className="label" htmlFor="ps">Status</label><AutoSubmitSelect id="ps" name="status" defaultValue={searchParams.status ?? ""} className="select w-40"><option value="">All</option>{["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</AutoSubmitSelect></div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={searchParams.archived === "1"} />Show archived</label>
          <button className="btn-outline">Apply</button>
          <Link href="/admin/projects/new" className="btn-primary ml-auto">New project</Link>
        </form>
        <FilterChips base="/admin/projects" params={searchParams} chips={[
          ...(searchParams.status ? [{ key: "status", label: "Status", value: searchParams.status.replace("_", " ").toLowerCase() }] : []),
          ...(path.district && searchParams.district ? [{ key: "district", label: "District", value: path.district.name, clears: ["localBody", "ward"] }] : []),
          ...(path.localBody && searchParams.localBody ? [{ key: "localBody", label: "Area", value: path.localBody.name, clears: ["ward"] }] : []),
          ...(path.ward && searchParams.ward ? [{ key: "ward", label: "Ward", value: `Ward ${path.ward.number}` }] : []),
          ...(searchParams.q ? [{ key: "q", label: "Search", value: searchParams.q }] : []),
          ...(searchParams.archived ? [{ key: "archived", label: "Showing", value: "archived" }] : []),
        ]} />
      </div>
      {res.items.length === 0 ? <div className="admin-panel p-4"><EmptyState title="No projects found" action={<Link href="/admin/projects/new" className="btn-primary">Create a project</Link>} /></div> : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {res.items.map((p) => (
            <li key={p.id} className="admin-panel p-4">
              <div className="flex items-start justify-between gap-2"><p className="text-xs text-ink-500">{p.category.name}, {p.code}</p>{!p.isPublic && <span className="badge bg-muted text-ink-500">Internal</span>}</div>
              <Link href={`/admin/projects/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{p.name}</Link>
              <p className="text-xs text-ink-500">Ward {p.ward.number}, {p.ward.localBody.name}{p.department ? `, ${p.department.name}` : ""}</p>
              <div className="mt-3 flex items-center gap-2"><ProgressBar value={p.progress} label={`${p.name} progress`} /><span className="text-sm font-semibold">{p.progress}%</span></div>
              <p className="mt-2 text-xs text-ink-500">{fmtINR(p.expenditure)} of {fmtINR(p.budget)} spent, due {fmtDate(p.targetDate)} ({p.status.replace("_", " ").toLowerCase()})</p>
            </li>
          ))}
        </ul>
      )}
      <div className="[&_*]:text-white"><Pagination page={res.page} pages={res.pages} href={href} /></div>
    </>
  );
}
