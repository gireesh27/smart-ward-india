import { requireAdminPage } from "@/lib/session";
import { compareWards, latestScorePeriod, wardPerformance, wardWhere } from "@/lib/services/analytics";
import { activeIndicatorDefs } from "@/lib/services/scores";
import { monthKey, monthStart } from "@/lib/domain/period";
import { fmtPct } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { WardCompare } from "@/components/admin/AdminPickers";
import { Card, EmptyState } from "@/components/ui";
import { TrendChart } from "@/components/client/Charts";
import { GeoPicker } from "@/components/client/GeoPicker";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";

export const metadata = { title: "Ward analytics" };
const COLORS = ["#1b66e3", "#22a04b", "#f5901d", "#7a45e4"];

export default async function WardAnalytics({ searchParams }: { searchParams: { wards?: string | string[]; range?: string } }) {
  const actor = await requireAdminPage("/admin/analytics");
  const months = [6, 12, 24].includes(Number(searchParams.range)) ? Number(searchParams.range) : 12;
  let selected = ([] as string[]).concat(searchParams.wards ?? []).flatMap((w) => w.split(",")).filter(Boolean).slice(0, 4);
  if (!selected.length) {
    // Default: the two lowest-scoring wards in scope, so the page opens on something useful.
    const ww = wardWhere(actor, {});
    const asOf = await latestScorePeriod(ww, monthStart(new Date()));
    selected = (await wardPerformance(ww, new Date(), asOf, 2, "asc")).map((w) => w.id);
  }
  const [cmp, defs] = await Promise.all([compareWards(actor, selected, new Date(), months), activeIndicatorDefs()]);
  const chartData = cmp.months.map((m, i) => ({ label: m.label, ...Object.fromEntries(cmp.wards.map((w, j) => [`w${j}`, w.series[i]])) }));

  return (
    <>
      <AdminTopBar actor={actor} title="Ward Analytics" subtitle="Compare wards, indicators and complaint resolution" />
      <section className="admin-panel mb-4 p-4" aria-label="Choose wards to compare">
        <WardCompare selected={cmp.wards.map((w) => ({ id: w.id, label: w.label }))} range={months} />
        <form method="get" className="mt-3 flex items-end gap-2">
          {cmp.wards.length > 0 && <input type="hidden" name="wards" value={cmp.wards.map((w) => w.id).join(",")} />}
          <div><label className="label" htmlFor="range">Period</label><select id="range" name="range" defaultValue={String(months)} className="select w-44"><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="24">Last 24 months</option></select></div>
          <button className="btn-outline">Apply period</button>
        </form>
      </section>

      {cmp.wards.length === 0 ? <div className="admin-panel p-4"><EmptyState title="Choose at least one ward">Pick a district, Panchayat or Municipality and ward above, then add it to the comparison.</EmptyState></div> : (
        <>
          <Card variant="admin" title="Development score over time" className="mb-4">
            <TrendChart caption="Development score per selected ward by month" data={chartData} series={cmp.wards.map((w, j) => ({ key: `w${j}`, name: w.label, color: COLORS[j], badgeLast: true }))} />
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            {cmp.wards.map((w, j) => (
              <Card key={w.id} variant="admin" title={w.label} icon={<span className="h-3 w-3 rounded-full" style={{ background: COLORS[j] }} aria-hidden="true" />}>
                <p className="-mt-1 mb-3 text-xs text-ink-500">{w.district} district</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><p className="text-xs text-ink-500">Latest score</p><p className="font-display text-3xl font-bold text-navy-700">{w.latestScore ?? "—"}</p><p className="text-xs text-ink-500">{w.latestScore == null ? "Insufficient data" : `${w.latestPeriod}, ${Math.round((w.coverage ?? 0) * 100)}% data coverage`}</p></div>
                  <div><p className="text-xs text-ink-500">Complaints ({months} mo)</p><p className="font-display text-2xl font-bold">{w.reported}</p><p className="text-xs">{w.resolved} resolved ({fmtPct(w.rate)})</p></div>
                  <div><p className="text-xs text-ink-500">Open now</p><p className="font-display text-2xl font-bold">{w.open}</p><p className={`text-xs ${w.overdue ? "font-semibold text-alert-600" : ""}`}>{w.overdue} overdue, average {w.avgResolutionHours == null ? "—" : `${Math.round(w.avgResolutionHours)} h`} to resolve</p></div>
                </div>
                <h3 className="mt-4 text-sm font-semibold">Score breakdown</h3>
                <div className="overflow-x-auto"><table className="table mt-1 min-w-[460px] text-[13px]"><thead><tr><th scope="col">Indicator</th><th scope="col">Value</th><th scope="col">Normalised</th><th scope="col">Weight</th><th scope="col">Points</th></tr></thead>
                  <tbody>{w.breakdown.map((b) => <tr key={b.key}><td>{b.name}</td><td>{b.value ?? "missing"}</td><td>{b.normalized ?? "—"}</td><td>{b.weight}</td><td>{b.points ?? "—"}</td></tr>)}</tbody></table></div>
                {w.weakIndicators.length > 0 && <p className="mt-2 text-sm"><strong className="text-alert-600">Below 75:</strong> {w.weakIndicators.join(", ")}</p>}
                <h3 className="mt-4 text-sm font-semibold">Lowest resolution by category</h3>
                <ul className="mt-1 text-[13px]">{w.categories.slice(0, 4).map((c) => <li key={c.category} className="flex justify-between border-b border-line py-1"><span>{c.category}</span><span>{c.resolved}/{c.reported} ({fmtPct(c.rate)})</span></li>)}</ul>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card variant="admin" title="Record an indicator reading" className="mt-4">
        <p className="mb-3 text-sm text-ink-700">Monthly survey values feed the development score. Saving rescores that ward-month immediately and is recorded in the audit log.</p>
        <ApiForm action="/api/admin/readings" successMessage="Reading saved and score recalculated." className="space-y-3">
          <GeoPicker names={{ ward: "wardId" }} scoped required idPrefix="rd" className="grid gap-3 sm:grid-cols-4" />
          <FieldError name="wardId" />
          <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><label className="label" htmlFor="r-ind">Indicator</label><select id="r-ind" name="indicatorId" className="select" required>{defs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label" htmlFor="r-period">Month</label><input id="r-period" name="period" type="month" className="input" defaultValue={monthKey(new Date())} required /><FieldError name="period" /></div>
            <div><label className="label" htmlFor="r-value">Value</label><input id="r-value" name="value" type="number" step="0.1" className="input" required /><FieldError name="value" /></div>
            <SubmitButton>Save reading</SubmitButton>
          </div>
        </ApiForm>
      </Card>
    </>
  );
}
