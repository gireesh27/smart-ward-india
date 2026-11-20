import Link from "next/link";
import { getDashboard } from "@/lib/services/analytics";
import { geoPathFor } from "@/lib/services/geo";
import { parseMonthKey, lastNMonths, monthKey, monthLabel } from "@/lib/domain/period";
import { fmtInt, fmtPct } from "@/lib/format";
import { BandDot, Card, Change, EmptyState, ProgressBar, SegmentDonut } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { ActivityChart, DistrictRankChart, IndicatorRadar, TrendChart } from "@/components/client/Charts";
import { AtlasMap } from "@/components/client/AtlasMap";
import { GeoPicker } from "@/components/client/GeoPicker";
import { AutoSubmitSelect } from "@/components/client/AutoSubmit";
import { SortHeader } from "@/components/data/TableControls";

export const metadata = { title: "Public dashboard", description: "Development scores, complaint resolution and public projects for every district, Gram Panchayat, municipality and ward in Andhra Pradesh.", alternates: { canonical: "/dashboard" } };

export default async function PublicDashboard({ searchParams }: { searchParams: { district?: string; localBody?: string; ward?: string; month?: string; dsort?: string } }) {
  const month = parseMonthKey(searchParams.month);
  const f = { districtId: searchParams.district || undefined, localBodyId: searchParams.localBody || undefined, wardId: searchParams.ward || undefined };
  const [d, path] = await Promise.all([
    getDashboard(null, f, month, { publicView: true, performanceLimit: 10 }),
    geoPathFor({ wardId: f.wardId, localBodyId: f.localBodyId, districtId: f.districtId }),
  ]);
  const months = lastNMonths(new Date(), 12).reverse();
  const area = path.ward ? `Ward ${path.ward.number}, ${path.localBody?.name}` : path.localBody?.name ?? path.district?.name ?? "Andhra Pradesh";

  return (
    <div className="mx-auto max-w-page px-4 py-8 md:px-8">
      <div>
        <h1 className="text-3xl font-bold text-navy-700">Public development dashboard</h1>
        <p className="mt-1 text-sm text-ink-700">{area}. Aggregated figures only: no personal information, complaint locations or internal notes are shown.</p>
      </div>
      <form method="get" className="card mt-4 p-4" aria-label="Dashboard filters">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px]">
          <GeoPicker defaultValue={path} names={{ district: "district", localBody: "localBody", ward: "ward" }} autoSubmit idPrefix="pd" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" />
          <div><label className="label" htmlFor="f-month">Month</label><AutoSubmitSelect id="f-month" name="month" defaultValue={monthKey(month)} className="select">{months.map((m) => <option key={monthKey(m)} value={monthKey(m)}>{monthLabel(m, "long")}</option>)}</AutoSubmitSelect></div>
        </div>
        <noscript><button className="btn-primary btn-sm mt-3">Apply</button></noscript>
      </form>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Wards (LGD)", v: fmtInt(d.kpis.totalWards), c: <span className="text-sm text-ink-500">Official Local Government Directory wards</span> },
          { k: `Reported in ${d.monthLabel}`, v: fmtInt(d.kpis.reported), c: <Change value={d.kpis.reportedChange} invert /> },
          { k: "Resolved", v: fmtInt(d.kpis.resolved), c: <span className="text-sm text-ink-700">{fmtPct(d.kpis.resolutionRate, 0)} resolution rate</span> },
          { k: "Development score", v: d.kpis.devScore == null ? "Insufficient data" : `${d.kpis.devScore} / 100`, c: <Change value={d.kpis.devScoreChange} suffix=" pts" /> },
        ].map((x) => (
          <div key={x.k}><div className="card h-full p-4"><dt className="text-sm text-ink-500">{x.k}</dt><dd className="mt-1 font-display text-3xl font-bold text-navy-700">{x.v}</dd><dd className="mt-1">{x.c}</dd></div></div>
        ))}
      </dl>
      {d.scoreAsOf && <p className="mt-2 text-xs text-ink-500">Scores use indicator data for {d.scoreAsOf}. Development activity is currently recorded for pilot areas only.</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Andhra Pradesh by district" bodyClassName="p-2">
          <AtlasMap selectedDistrictId={path.district?.id} districtHref="/dashboard?district={id}" month={d.month} height={420} />
          <p className="px-2 pt-1 text-xs text-ink-500">Districts, mandals and assembly constituencies, shaded by development score. Pinch or use + / − to zoom; tap an area for details. <Link className="link" href="/map">Open the full-screen map</Link></p>
        </Card>
        <Card title="Development trends">
          <TrendChart caption="Monthly development score, complaint resolution rate and citizen satisfaction" data={d.trends} series={[{ key: "devScore", name: "Development score", color: "#1b66e3", badgeLast: true }, { key: "resolution", name: "Complaint resolution %", color: "#3cbe2a" }, { key: "satisfaction", name: "Citizen satisfaction", color: "#f5901d" }]} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Complaints reported and resolved">
          <ActivityChart caption={`Complaints reported and resolved each month, with the resolution rate, for ${area}`} data={d.trends} filename="complaints-by-month" />
        </Card>
        <Card title="Indicator profile">
          <IndicatorRadar caption={`Score of each development indicator for ${area}${d.scoreAsOf ? `, ${d.scoreAsOf}` : ""}`} data={d.indicators} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Infrastructure indicators">
          <ul className="space-y-3">
            {d.indicators.map((i) => (
              <li key={i.key} className="grid grid-cols-[24px_1fr_52px] items-center gap-3">
                <CategoryIcon name={i.icon} className="h-5 w-5 text-brand-600" />
                <div><p className="text-sm font-medium text-ink-900">{i.name}</p><p className="text-xs text-ink-500">{i.unit}</p><ProgressBar value={i.score} label={i.name} className="mt-1" /></div>
                <span className="text-right text-sm font-semibold">{i.score == null ? "—" : `${i.score}%`}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Complaints by category — ${d.monthLabel}`}>
          {d.distribution.total === 0 ? <EmptyState title="No complaints reported in this area this month" /> : (
            <div className="flex flex-wrap items-center gap-6">
              <SegmentDonut items={d.distribution.items}><span className="font-display text-2xl font-bold text-navy-700">{fmtInt(d.distribution.total)}</span><span className="text-xs">Total</span></SegmentDonut>
              <ul className="space-y-2 text-sm">{d.distribution.items.map((i) => <li key={i.id} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: i.color }} aria-hidden="true" />{i.name}<span className="ml-auto pl-6 font-semibold">{i.pct}%</span></li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      {d.districts.length > 2 && (
        <Card title="Development score by district" className="mt-4">
          <DistrictRankChart caption="Average development score of each district, highest first" data={d.districts} />
        </Card>
      )}

      <Card title="Districts" className="mt-4" bodyClassName="overflow-x-auto p-0">
        <table className="table min-w-[720px]">
          <caption className="sr-only">Real LGD structure and activity per district</caption>
          <thead><tr>{([["District", "name", "asc"], ["Local bodies", "localBodies", "desc"], ["Wards", "wards", "desc"], ["Score", "score", "desc"]] as const).map(([label, field, dir]) => <SortHeader key={field} label={label} field={field} firstDir={dir} current={searchParams.dsort} paramKey="dsort" base="/dashboard" params={searchParams} />)}<th scope="col">Status</th><SortHeader label={`Complaints (${d.monthLabel})`} field="reported" firstDir="desc" current={searchParams.dsort} paramKey="dsort" base="/dashboard" params={searchParams} /></tr></thead>
          <tbody>{sortDistricts(d.districts, searchParams.dsort).map((x) => <tr key={x.id}><td><Link className="link" href={`/dashboard?district=${x.id}`}>{x.name}</Link></td><td>{x.localBodies.toLocaleString("en-IN")}</td><td>{x.wards.toLocaleString("en-IN")}</td><td>{x.score ?? "—"}</td><td><BandDot band={x.band} /></td><td>{x.reported}</td></tr>)}</tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Wards needing attention" bodyClassName="overflow-x-auto p-0">
          {d.performance.length === 0 ? <div className="p-4"><EmptyState title="No ward scores for this selection yet" /></div> : (
            <table className="table min-w-[520px]"><thead><tr><th scope="col">Ward</th><th scope="col">Score</th><th scope="col">Status</th><th scope="col">Open now</th></tr></thead>
              <tbody>{d.performance.map((w) => <tr key={w.id}><td>Ward {w.number}<span className="block text-xs text-ink-500">{w.localBody}, {w.district}</span></td><td>{w.score ?? "—"}</td><td><BandDot band={w.band} /></td><td>{w.open}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card title="Public development projects">
          {d.projects.length === 0 ? <EmptyState title="No public projects in this area yet" /> : (
            <ul className="divide-y divide-line">{d.projects.map((p) => <li key={p.id} className="py-3"><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link><p className="text-xs text-ink-500">Ward {p.ward.number}, {p.ward.localBody.name}, {p.status.replace("_", " ").toLowerCase()}</p><ProgressBar value={p.progress} label={`${p.name} progress`} className="mt-1" /></li>)}</ul>
          )}
          {d.insights.length > 0 && <div className="mt-4 border-t border-line pt-3"><h3 className="mb-2 text-sm font-semibold">Current alerts (rule-based)</h3><ul className="space-y-1.5 text-sm">{d.insights.map((i) => <li key={i.id} className="flex gap-2"><span className={`badge ${i.severity === "HIGH" ? "bg-alert-100 text-alert-600" : "bg-saffron-100 text-saffron-600"}`}>{i.severity}</span><span>{i.title} — Ward {i.ward?.number}, {i.ward?.localBody.name}</span></li>)}</ul></div>}
        </Card>
      </div>
    </div>
  );
}

type DistrictRow = { name: string; localBodies: number; wards: number; score: number | null; reported: number };
function sortDistricts<T extends DistrictRow>(rows: T[], sort?: string): T[] {
  const [field, dir] = (sort ?? "name.asc").split(".") as [keyof DistrictRow, string];
  if (!["name", "localBodies", "wards", "score", "reported"].includes(field)) return rows;
  const k = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[field], y = b[field];
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * k;
  });
}
