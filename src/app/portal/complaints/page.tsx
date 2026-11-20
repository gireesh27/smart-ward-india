import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { listComplaints } from "@/lib/services/complaints";
import { complaintListSchema } from "@/lib/validation";
import { cleanParams, fmtDate } from "@/lib/format";
import { EmptyState, PageTitle, Pagination, StatusBadge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client/AutoSubmit";

export const metadata = { title: "My complaints" };

export default async function MyComplaints({ searchParams }: { searchParams: Record<string, string> }) {
  const actor = await requireActor("/portal/complaints");
  const parsed = complaintListSchema.safeParse({ ...cleanParams(searchParams), pageSize: 15 });
  const q = parsed.success ? parsed.data : complaintListSchema.parse({ pageSize: 15 });
  // Citizens only ever see their own complaints, even if they are also administrators.
  const [res, categories] = await Promise.all([listComplaints({ ...actor, isAdmin: false }, q), prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })]);
  const qs = (p: number) => `?${new URLSearchParams({ ...searchParams, page: String(p) })}`;
  return (
    <>
      <PageTitle title="My complaints" subtitle={`${res.total} report${res.total === 1 ? "" : "s"}`} actions={<Link href="/portal/report" className="btn-primary">Report an issue</Link>} />
      <form method="get" className="mb-4 flex flex-wrap gap-2" aria-label="Filter complaints">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={q.q} placeholder="Search reference, title or address" className="input w-64" />
        <label className="sr-only" htmlFor="status">Status</label>
        <AutoSubmitSelect id="status" name="status" defaultValue={searchParams.status ?? ""} className="select w-44"><option value="">All statuses</option><option value="open">Open</option><option value="done">Resolved or closed</option><option value="RESOLVED">Awaiting my review</option><option value="REJECTED">Rejected</option></AutoSubmitSelect>
        <label className="sr-only" htmlFor="category">Category</label>
        <AutoSubmitSelect id="category" name="category" defaultValue={q.category ?? ""} className="select w-44"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
        <label className="sr-only" htmlFor="sort">Sort</label>
        <AutoSubmitSelect id="sort" name="sort" defaultValue={q.sort} className="select w-36"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></AutoSubmitSelect>
        <button className="btn-outline">Search</button>
      </form>
      {res.items.length === 0 ? (
        <EmptyState title={searchParams.q || searchParams.status || searchParams.category ? "No complaints match these filters" : "You have not reported anything yet"} action={<Link href="/portal/report" className="btn-primary">Report an issue</Link>} />
      ) : (
        <ul className="space-y-3">
          {res.items.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/portal/complaints/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{c.title}</Link>
                <p className="text-xs text-ink-500">{c.category.name} in Ward {c.ward.number}, {c.ward.localBody.name}. Reported {fmtDate(c.createdAt)}, reference {c.reference}</p>
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={res.page} pages={res.pages} href={qs} />
    </>
  );
}
