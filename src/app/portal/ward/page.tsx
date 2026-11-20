import Link from "next/link";
import { requireActor } from "@/lib/session";
import { getDashboard } from "@/lib/services/analytics";
import { wardLabel } from "@/lib/services/geo";
import { listPublicIssues } from "@/lib/services/complaints";
import { SupportButton } from "@/components/client/SupportButton";
import { Card, Change, Donut, EmptyState, PageTitle, ProgressBar, SegmentDonut, StatusBadge } from "@/components/ui";
import { TrendChart } from "@/components/client/Charts";
import { CategoryIcon } from "@/components/icons";
import { fmtDate, fmtInt, fmtPct } from "@/lib/format";

export const metadata = { title: "My ward" };

export default async function MyWard() {
  const actor = await requireActor("/portal/ward");
  if (!actor.wardId) return <><PageTitle title="My ward" /><EmptyState title="Choose your home ward" action={<Link href="/portal/profile" className="btn-primary">Set my ward</Link>}>Your ward overview appears once you add your home ward to your profile.</EmptyState></>;
  const [label, d, issues] = await Promise.all([wardLabel(actor.wardId), getDashboard(null, { wardId: actor.wardId }, new Date(), { publicView: true }), listPublicIssues(actor.id, { wardId: actor.wardId, limit: 12 })]);
  return (
    <>
      <PageTitle title={label?.label ?? "My ward"} subtitle={`${label?.localBody.district.name} district, figures for ${d.monthLabel}`} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
        <Card title="Development score" bodyClassName="flex flex-col items-center p-4">
          <Donut value={d.kpis.devScore} label={`Development score ${d.kpis.devScore ?? "insufficient data"}`}><span className="font-display text-3xl font-bold text-navy-700">{d.kpis.devScore ?? "—"}</span><span className="text-xs">out of 100</span></Donut>
          <div className="mt-2"><Change value={d.kpis.devScoreChange} suffix=" pts" /></div>
          {d.scoreAsOf && <p className="mt-1 text-xs text-ink-500">Indicator data: {d.scoreAsOf}</p>}
        </Card>
        <Card title="Indicators">
          <ul className="space-y-3">{d.indicators.map((i) => <li key={i.key} className="grid grid-cols-[22px_1fr_44px] items-center gap-2"><CategoryIcon name={i.icon} className="h-5 w-5 text-brand-600" /><div><p className="text-sm">{i.name}</p><ProgressBar value={i.score} label={i.name} /></div><span className="text-right text-sm font-semibold">{i.score ?? "—"}%</span></li>)}</ul>
        </Card>
        <Card title="This month">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-500">Reported</dt><dd className="font-display text-2xl font-bold">{fmtInt(d.kpis.reported)}</dd></div>
            <div><dt className="text-ink-500">Resolved</dt><dd className="font-display text-2xl font-bold">{fmtInt(d.kpis.resolved)}</dd></div>
            <div className="col-span-2"><dt className="text-ink-500">Resolution rate</dt><dd className="font-semibold">{fmtPct(d.kpis.resolutionRate)}</dd></div>
          </dl>
          {d.distribution.total > 0 && <div className="mt-3 flex items-center gap-3"><SegmentDonut items={d.distribution.items} size={110} stroke={22} /><ul className="text-xs">{d.distribution.items.map((i) => <li key={i.id}>{i.name}: {i.pct}%</li>)}</ul></div>}
        </Card>
      </div>
      <Card title="Trends" className="mt-4"><TrendChart caption="Ward development score and resolution rate by month" data={d.trends} series={[{ key: "devScore", name: "Development score", color: "#1b66e3", badgeLast: true }, { key: "resolution", name: "Complaint resolution %", color: "#3cbe2a" }, { key: "satisfaction", name: "Citizen satisfaction", color: "#f5901d" }]} /></Card>
      <Card title="Open issues reported by neighbours" className="mt-4">
        {issues.length === 0 ? <p className="text-sm text-ink-500">No open public reports in your ward right now.</p> : (
          <ul className="divide-y divide-line">
            {issues.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="font-medium text-ink-900">{i.title}</p><p className="text-xs text-ink-500">{i.category.name}, reported {fmtDate(i.createdAt)} (reference {i.reference})</p></div>
                <StatusBadge status={i.status} />
                {i.mine ? <span className="badge bg-brand-50 text-brand-700">Your report: {i.supportCount} {i.supportCount === 1 ? "supporter" : "supporters"}</span> : <SupportButton complaintId={i.id} count={i.supportCount} supported={i.supportedByMe} compact />}
              </li>
            ))}
          </ul>
        )}
        <p className="hint mt-2">Supporting tells the ward office how many people are affected. Only titles, categories and status are shown — names, addresses, descriptions and photos stay private.</p>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Projects in your ward">{d.projects.length === 0 ? <p className="text-sm text-ink-500">No public projects yet.</p> : <ul className="divide-y divide-line">{d.projects.map((p) => <li key={p.id} className="py-2"><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link><ProgressBar value={p.progress} label={`${p.name} progress`} className="mt-1" /></li>)}</ul>}</Card>
        <Card title="Alerts (rule-based)">{d.insights.length === 0 ? <p className="text-sm text-ink-500">No active alerts for your ward.</p> : <ul className="space-y-2 text-sm">{d.insights.map((i) => <li key={i.id}><strong>{i.title}</strong> — {i.summary}</li>)}</ul>}</Card>
      </div>
    </>
  );
}
