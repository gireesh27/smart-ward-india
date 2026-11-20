import Link from "next/link";
import { requireActor } from "@/lib/session";
import { listProjects } from "@/lib/services/projects";
import { EmptyState, PageTitle, Pagination, ProgressBar } from "@/components/ui";
import { fmtDate, fmtINR } from "@/lib/format";

export const metadata = { title: "Development projects" };

export default async function PortalProjects({ searchParams }: { searchParams: { scope?: string; page?: string } }) {
  const actor = await requireActor("/portal/projects");
  const mine = searchParams.scope !== "all" && !!actor.wardId;
  const res = await listProjects(null, { ward: mine ? actor.wardId! : undefined, page: Number(searchParams.page) || 1 });
  return (
    <>
      <PageTitle title="Development projects" subtitle="Public projects and their progress." actions={actor.wardId ? <div className="flex gap-2"><Link href="?scope=mine" className={mine ? "btn-primary btn-sm" : "btn-outline btn-sm"}>My ward</Link><Link href="?scope=all" className={!mine ? "btn-primary btn-sm" : "btn-outline btn-sm"}>All wards</Link></div> : undefined} />
      {res.items.length === 0 ? <EmptyState title="No public projects here yet" action={mine ? <Link className="btn-outline" href="?scope=all">See all wards</Link> : undefined} /> : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {res.items.map((p) => (
            <li key={p.id} className="card p-4">
              <p className="text-xs text-ink-500">{p.category.name}, {p.code}</p>
              <Link href={`/projects/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{p.name}</Link>
              <p className="text-xs text-ink-500">Ward {p.ward.number}, {p.ward.localBody.name}</p>
              <div className="mt-3 flex items-center gap-2"><ProgressBar value={p.progress} label={`${p.name} progress`} /><span className="text-sm font-semibold">{p.progress}%</span></div>
              <p className="mt-2 text-xs text-ink-500">Budget {fmtINR(p.budget)}, due {fmtDate(p.targetDate)}</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={res.page} pages={res.pages} href={(n) => `?scope=${mine ? "mine" : "all"}&page=${n}`} />
    </>
  );
}
