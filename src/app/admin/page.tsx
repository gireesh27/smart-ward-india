import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Download, Droplets, FileBarChart, Home, LineChart, MapPin, Sparkles, TrendingUp, Trophy, Users, Zap, Building2, Landmark } from "@/components/app-icons";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { getDashboard } from "@/lib/services/analytics";
import { maybeRefreshInsights } from "@/lib/services/insights";
import { lastNMonths, monthKey, monthLabel, parseMonthKey } from "@/lib/domain/period";
import { fmtInt } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { BandDot, Card, EmptyState, SegmentDonut } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { TrendChart } from "@/components/client/Charts";
import { AtlasMap } from "@/components/client/AtlasMap";
import { GeoPicker } from "@/components/client/GeoPicker";
import { geoPathFor } from "@/lib/services/geo";
import { AutoSubmitSelect } from "@/components/client/AutoSubmit";

export const metadata = { title: "Admin dashboard" };

const pill = "cursor-pointer appearance-none rounded-full border border-white/25 bg-[#0b2a5e]/90 py-2 pl-10 pr-8 text-[14px] font-medium text-white outline-none hover:bg-[#123673] focus-visible:ring-2 focus-visible:ring-saffron-500";
const barColor = (v: number | null) => (v == null ? "#c9d5e8" : v >= 85 ? "#22a04b" : v >= 78 ? "#1b66e3" : v >= 74 ? "#ffa918" : "#de0d22");

function Kpi({ tone, icon, label, value, change }: { tone: string; icon: React.ReactNode; label: string; value: React.ReactNode; change: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-4 rounded-xl px-5 py-4 text-white shadow-kpi ring-1 ring-white/15 2xl:gap-5 2xl:px-6 2xl:py-5 ${tone}`}>
      <span className="shrink-0 [&>svg]:h-11 [&>svg]:w-11 2xl:[&>svg]:h-14 2xl:[&>svg]:w-14" aria-hidden="true">{icon}</span>
      <div className="min-w-0"><p className="truncate text-[15px] font-medium 2xl:text-[17px]">{label}</p><p className="truncate font-display text-[26px] font-bold leading-tight 2xl:text-[32px]">{value}</p><div className="text-[14px]">{change}</div></div>
    </div>
  );
}
function Delta({ v, suffix = "%", label }: { v: number | null; suffix?: string; label: string }) {
  if (v == null) return <span className="text-white/80">No comparison data</span>;
  return <span><span className="font-semibold text-[#b6ffb0]">{v >= 0 ? "↑ +" : "↓ −"}{Math.abs(v)}{suffix}</span> <span className="text-white/90">{label}</span></span>;
}

export default async function AdminDashboard({ searchParams }: { searchParams: { state?: string; district?: string; localBody?: string; ward?: string; month?: string; range?: string } }) {
  const actor = await requireAdminPage();
  await maybeRefreshInsights();
  const month = parseMonthKey(searchParams.month);
  const range = ["6", "12", "24"].includes(searchParams.range ?? "") ? Number(searchParams.range) : 12;
  const path = await geoPathFor({ wardId: searchParams.ward, localBodyId: searchParams.localBody, districtId: searchParams.district });
  const d = await getDashboard(actor, { stateId: searchParams.state || undefined, districtId: searchParams.district || undefined, localBodyId: searchParams.localBody || undefined, wardId: searchParams.ward || undefined }, month, { trendMonths: range });
  const months = lastNMonths(new Date(), 24).reverse();
  const qs = (extra: Record<string, string>) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v)), ...extra })}`;
  const areaName = path.ward ? `Ward ${path.ward.number}` : path.localBody?.name ?? path.district?.name ?? path.state?.name ?? "All areas";
  const top = d.insights[0];
  const rec = d.insights.find((i) => i.ruleKey === "ROAD_REPAIR_PRIORITY") ?? d.insights[1];
  const exportQs = new URLSearchParams({ type: "wards", format: "pdf", month: d.month, ...(searchParams.district ? { district: searchParams.district } : {}), ...(searchParams.ward ? { ward: searchParams.ward } : {}) });

  return (
    <>
      <AdminTopBar actor={actor} title="Smart Ward India" subtitle="Panchayat & Municipality Development Platform">
        <form method="get" className="flex flex-wrap items-center gap-2.5" aria-label="Dashboard filters">
          <input type="hidden" name="range" value={String(range)} />
          <GeoPicker defaultValue={path} names={{ state: "state", district: "district", localBody: "localBody", ward: "ward" }} scoped autoSubmit variant="pill" showLabels={false} idPrefix="f" />
          <div className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" aria-hidden="true" /><label className="sr-only" htmlFor="f-month">Month</label>
            <AutoSubmitSelect id="f-month" name="month" defaultValue={d.month} className={pill}>{months.map((m) => <option key={monthKey(m)} value={monthKey(m)} className="text-ink-900">{monthLabel(m)} {m.getUTCFullYear()}</option>)}</AutoSubmitSelect></div>
          <noscript><button className="btn-primary btn-sm">Apply</button></noscript>
        </form>
      </AdminTopBar>

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi tone="bg-gradient-to-br from-[#0b4fc4] to-[#1f74f0]" icon={<Building2 />} label="Total Wards" value={fmtInt(d.kpis.totalWards)} change={<Delta v={d.kpis.totalWardsChange} label="vs last month" />} />
        <Kpi tone="bg-gradient-to-br from-[#0b6a33] to-[#22a04b]" icon={<AlertTriangle />} label="Reported Issues" value={fmtInt(d.kpis.reported)} change={<Delta v={d.kpis.reportedChange} label="vs last month" />} />
        <Kpi tone="bg-gradient-to-br from-[#e05f05] to-[#f99a1e]" icon={<CheckCircle2 />} label="Resolved" value={fmtInt(d.kpis.resolved)} change={d.kpis.resolutionRate == null ? <span>No reports this month</span> : <span><span className="font-semibold text-[#d9ffd2]">↑ {Math.round(d.kpis.resolutionRate)}%</span> Success Rate</span>} />
        <Kpi tone="bg-gradient-to-br from-[#3c1f9a] to-[#7a45e4]" icon={<TrendingUp />} label="Development Score" value={d.kpis.devScore == null ? "No data" : `${d.kpis.devScore} / 100`} change={<Delta v={d.kpis.devScoreChange} suffix="" label={d.scoreAsOf ? `vs previous month` : ""} />} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1.95fr_1.8fr_1fr]">
        <Card variant="admin" title="District Overview" icon={<BarChart3 className="h-5 w-5 text-brand-400" aria-hidden="true" />} action={<Link href="/admin/analytics" className="inline-flex items-center gap-1 text-[14px] font-medium text-white hover:underline">View Details <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>} bodyClassName="cq p-3">
          <div className="split-map">
            <div className="relative">
              <AtlasMap variant="compact" palette="blue" selectedDistrictId={path.district?.id} districtHref="/admin?district={id}" month={d.month} height={260} />
              <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded-lg bg-surface/95 px-3 py-1.5 shadow-float">
                <p className="font-display text-[15px] font-bold leading-tight text-alert-600">{areaName}</p>
                <p className="font-display text-[19px] font-bold leading-tight text-navy-700">{d.kpis.devScore == null ? "—" : `${d.kpis.devScore}%`}</p>
              </div>
            </div>
            <ul className="space-y-[15px] self-center">
              {d.indicators.map((i) => (
                <li key={i.key} className="grid grid-cols-[26px_1fr_48px] items-center gap-2">
                  <CategoryIcon name={i.icon} className="h-6 w-6" color={i.icon === "healthcare" ? "#de0d22" : i.icon === "water" ? "#1b66e3" : "rgb(var(--ink-700))"} />
                  <div><p className="text-[14px] font-semibold text-ink-900">{i.name === "Drinking Water" ? "Water Supply" : i.name}</p><div className="mt-1 h-[6px] rounded-full bg-track"><div className="h-full rounded-full" style={{ width: `${i.score ?? 0}%`, background: barColor(i.score) }} /></div></div>
                  <span className="text-right text-[15px] font-bold text-ink-900">{i.score == null ? "—" : `${i.score}%`}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card variant="admin" title="Development Trends" icon={<LineChart className="h-5 w-5 text-brand-400" aria-hidden="true" />} bodyClassName="px-3 pb-2 pt-1"
          action={<nav aria-label="Trend range" className="flex gap-1.5">{[["6", "6M"], ["12", "1Y"], ["24", "2Y"]].map(([v, l]) => <Link key={v} href={qs({ range: v })} aria-current={String(range) === v ? "true" : undefined} className={`rounded-md px-3 py-1 text-[13px] font-semibold ${String(range) === v ? "bg-brand-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>{l}</Link>)}</nav>}>
          <TrendChart height={238} caption={`Development score, complaint resolution and citizen satisfaction for the last ${range} months`} data={d.trends} series={[{ key: "devScore", name: "Development Score", color: "#1b66e3", badgeLast: true }, { key: "resolution", name: "Complaint Resolution", color: "#3cbe2a" }, { key: "satisfaction", name: "Citizen Satisfaction", color: "#f5901d" }]} />
        </Card>

        <Card variant="admin" title="Insights" icon={<Sparkles className="h-5 w-5 text-saffron-500" aria-hidden="true" />} className="lg:col-span-2 2xl:col-span-1" bodyClassName="flex flex-col gap-3 p-3">
          {!top ? <EmptyState title="No active alerts">All rule checks are within normal ranges for this selection.</EmptyState> : (
            <>
              <div className="relative overflow-hidden rounded-lg border border-alert-100 bg-alert-100/40 p-3">
                <Droplets className="absolute -right-2 top-2 h-20 w-20 text-brand-400/25" aria-hidden="true" />
                <p className="flex items-center gap-2 text-[15px] font-bold text-alert-600"><AlertTriangle className="h-5 w-5" aria-hidden="true" />{top.severity === "HIGH" ? "High" : "Medium"} Risk Alert</p>
                <p className="mt-1 text-[15px] font-semibold text-ink-900">{top.ruleKey === "WATER_SUPPLY_RISK" && d.waterRiskWards > 1 ? `Water Shortage Risk in ${d.waterRiskWards} Wards` : `${top.title} — Ward ${top.ward?.number}`}</p>
                <Link href={top.ruleKey === "WATER_SUPPLY_RISK" && d.waterRiskWards > 1 ? "/admin/insights?rule=WATER_SUPPLY_RISK" : top.link} className="mt-2 inline-flex items-center gap-1 rounded-md bg-alert-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-alert-500">View Details <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
              {rec && (
                <div className="rounded-lg bg-brand-50 p-3">
                  <p className="text-[15px] font-bold text-navy-700">Key Recommendation</p>
                  <p className="mt-1 flex gap-1.5 text-[14px] text-ink-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{rec.suggestedAction.split(".")[0]} — Ward {rec.ward?.number}, {rec.ward?.localBody.name}</p>
                  <div className="mt-2 text-right"><Link href={rec.link} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-700">Take Action <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
                </div>
              )}
              <p className="text-[11px] text-ink-500">Rule-based insights from complaint data — not forecasts.</p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[373fr_290fr_406fr_243fr]">
        <Card variant="admin" title="Ward-wise Performance" icon={<Trophy className="h-5 w-5 text-saffron-500" aria-hidden="true" />} bodyClassName="overflow-x-auto p-0">
          <table className="table text-[14px]">
            <caption className="sr-only">Development score and status for wards in this selection</caption>
            <thead><tr><th scope="col">Ward (lowest first)</th><th scope="col">Development Score</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
            <tbody>{d.performance.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-ink-500">No development scores for this selection yet.</td></tr> : d.performance.slice(0, 5).map((w) => (
              <tr key={w.id}><td>Ward {w.number}<span className="block max-w-[9rem] truncate text-[11px] text-ink-500">{w.localBody}</span></td><td className="font-semibold">{w.score ?? "—"}</td><td><BandDot band={w.band} /></td><td><Link href={`/admin/analytics?wards=${w.id}`} className="rounded border border-brand-400 px-2 py-0.5 text-[12px] font-medium text-brand-600 hover:bg-brand-50">View</Link></td></tr>
            ))}</tbody>
          </table>
          <p className="px-3 py-2 text-right text-[13px]"><Link className="link" href="/admin/reports">Full ward report</Link></p>
        </Card>

        <Card variant="admin" title="Citizen Complaints" icon={<Users className="h-5 w-5 text-brand-400" aria-hidden="true" />} bodyClassName="p-3">
          {d.distribution.total === 0 ? <EmptyState title="No complaints this month" /> : (
            <div className="flex flex-wrap items-center gap-4">
              <SegmentDonut items={d.distribution.items} size={150} stroke={30}><span className="font-display text-[24px] font-bold leading-none text-navy-700">{fmtInt(d.distribution.total)}</span><span className="text-[13px] font-semibold text-ink-900">Total</span></SegmentDonut>
              <ul className="flex-1 space-y-2 text-[14px]">{d.distribution.items.map((i) => <li key={i.id}><Link href={i.id === "others" ? "/admin/complaints" : `/admin/complaints?category=${i.id}`} className="flex items-center gap-2 hover:underline"><span className="h-3 w-3 rounded-full" style={{ background: i.color }} aria-hidden="true" />{i.name}<span className="ml-auto font-semibold">{i.pct}%</span></Link></li>)}</ul>
            </div>
          )}
        </Card>

        <Card variant="admin" title="Projects & Progress" icon={<FileBarChart className="h-5 w-5 text-saffron-500" aria-hidden="true" />} action={<Link href="/admin/projects" className="inline-flex items-center gap-1 text-[14px] text-white hover:underline">View All <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>} bodyClassName="p-3">
          {d.projects.length === 0 ? <EmptyState title="No projects in this selection" action={<Link href="/admin/projects/new" className="btn-primary btn-sm">Create project</Link>} /> : (
            <ul className="space-y-3">{d.projects.map((p) => {
              const status = p.status === "COMPLETED" ? ["Completed", "bg-leaf-600"] : p.progress >= 75 || new Date(p.targetDate) > new Date() ? (p.status === "IN_PROGRESS" && p.progress < 75 ? ["In Progress", "bg-brand-500"] : ["On Track", "bg-leaf-600"]) : ["Delayed", "bg-alert-600"];
              return (
                <li key={p.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
                  <span className="flex h-[46px] w-[52px] items-center justify-center rounded-md" style={{ background: `${p.category.color}22` }}><CategoryIcon name={p.category.slug} className="h-6 w-6" color={p.category.color} /></span>
                  <div className="min-w-0"><Link href={`/admin/projects/${p.id}`} className="block truncate text-[14px] font-semibold text-ink-900 hover:text-brand-600">{p.name}</Link><p className="text-[12px] text-ink-500">Ward {p.ward.number}, {p.ward.localBody.name}</p><div className="mt-1 flex items-center gap-2"><div className="h-[6px] flex-1 rounded-full bg-track"><div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.progress === 100 ? "#22a04b" : p.progress >= 75 ? "#22a04b" : "#1b66e3" }} /></div><span className="text-[13px] font-semibold">{p.progress}%</span></div></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-white ${status[1]}`}>{status[0]}</span>
                </li>
              );
            })}</ul>
          )}
        </Card>

        <section className="admin-panel flex flex-col" aria-labelledby="qa-title">
          <div className="card-head-admin"><Zap className="h-5 w-5 text-saffron-500" aria-hidden="true" /><h2 id="qa-title" className="font-display text-[17px] font-semibold text-white">Quick Actions</h2></div>
          <div className="flex flex-1 flex-col justify-center gap-2.5 bg-[#0b2459] p-3">
            <Link href="/admin/reports" className="flex items-center justify-center gap-2 rounded-md bg-[#012d76] px-3 py-2.5 text-[14px] font-semibold text-white ring-1 ring-brand-400/50 hover:bg-[#073a95]">View Detailed Reports <BarChart3 className="h-4 w-4" aria-hidden="true" /></Link>
            <a href={`/api/reports/export?${exportQs}`} className="flex items-center justify-center gap-2 rounded-md bg-leaf-700 px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-leaf-600">Download Development Report <Download className="h-4 w-4" aria-hidden="true" /></a>
            <Link href="/admin/insights#ai" className="flex items-center justify-center gap-2 rounded-md bg-[#3e29a0] px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-[#4f36c0]">Generate Insight Report <Sparkles className="h-4 w-4" aria-hidden="true" /></Link>
            <Link href="/admin/tools?tab=meetings#new-meeting" className="flex items-center justify-center gap-2 rounded-md bg-[#fb7600] px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-saffron-600">Schedule Review Meeting <Users className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </div>
      {d.scoreAsOf && <p className="mt-2 text-[12px] text-white/70">Development scores use indicator data for {d.scoreAsOf}. Complaint figures are for {d.monthLabel}.</p>}
    </>
  );
}
