import Link from "next/link";
import { ArrowRight, Megaphone } from "@/components/app-icons";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { citizenStats } from "@/lib/services/complaints";
import { publicAnnouncements } from "@/lib/services/content";
import { fmtDate, fmtRelative } from "@/lib/format";
import { Card, EmptyState, PageTitle, StatusBadge } from "@/components/ui";

export default async function PortalHome({ searchParams }: { searchParams: { notice?: string } }) {
  const actor = await requireActor("/portal");
  const [stats, recent, awaiting, notices, user] = await Promise.all([
    citizenStats(actor.id),
    prisma.complaint.findMany({ where: { reporterId: actor.id }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, reference: true, title: true, status: true, updatedAt: true, category: { select: { name: true } } } }),
    prisma.complaint.findMany({ where: { reporterId: actor.id, status: "RESOLVED" }, orderBy: { resolvedAt: "desc" }, take: 3, select: { id: true, reference: true, title: true, resolvedAt: true } }),
    publicAnnouncements(actor.wardId),
    prisma.user.findUnique({ where: { id: actor.id }, select: { ward: { select: { number: true, localBody: { select: { name: true } } } } } }),
  ]);
  return (
    <>
      {searchParams.notice === "admin-only" && <p role="alert" className="mb-4 rounded-md bg-saffron-100 px-4 py-3 text-sm">That area is for administrators. You are signed in as a citizen.</p>}
      <PageTitle title={`Namaste, ${actor.name.split(" ")[0]}`} subtitle={user?.ward ? `Your ward: Ward ${user.ward.number}, ${user.ward.localBody.name}` : undefined} actions={<Link href="/portal/report" className="btn-primary">Report an issue <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>} />
      {!user?.ward && <p className="mb-4 rounded-md bg-brand-50 px-4 py-3 text-sm">Set your home ward in your <Link className="link" href="/portal/profile">profile</Link> to see ward news and pre-fill reports.</p>}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Total reports", stats.total], ["Open", stats.open], ["Resolved or closed", stats.resolved], ["Awaiting your review", stats.awaitingFeedback]].map(([k, v]) => (
          <div key={k as string} className="card p-4"><dt className="text-sm text-ink-500">{k}</dt><dd className="font-display text-3xl font-bold text-navy-700">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Recent activity">
          {recent.length === 0 ? <EmptyState title="You have not reported anything yet" action={<Link href="/portal/report" className="btn-primary">Report your first issue</Link>}>Reports you submit appear here with their latest status.</EmptyState> : (
            <ul className="divide-y divide-line">{recent.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><Link className="link" href={`/portal/complaints/${c.id}`}>{c.title}</Link><p className="text-xs text-ink-500">{c.category.name}, reference {c.reference}, updated {fmtRelative(c.updatedAt)}</p></div><StatusBadge status={c.status} /></li>)}</ul>
          )}
          {recent.length > 0 && <Link href="/portal/complaints" className="link mt-3 inline-block text-sm">See all my complaints</Link>}
        </Card>
        <div className="space-y-4">
          <Card title="Please review these resolutions">
            {awaiting.length === 0 ? <p className="text-sm text-ink-500">Nothing to review right now.</p> : (
              <ul className="space-y-2 text-sm">{awaiting.map((c) => <li key={c.id}><Link className="link" href={`/portal/complaints/${c.id}#review`}>{c.title}</Link><p className="text-xs text-ink-500">Resolved {fmtDate(c.resolvedAt)}. Tell us whether it is fixed.</p></li>)}</ul>
            )}
          </Card>
          <Card title="Announcements" icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}>
            {notices.length === 0 ? <p className="text-sm text-ink-500">No announcements for your area.</p> : (
              <ul className="space-y-3">{notices.map((n) => <li key={n.id}><p className="font-semibold text-ink-900">{n.title}</p><p className="text-sm">{n.body}</p><p className="text-xs text-ink-500">{fmtDate(n.publishedAt)}</p></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
