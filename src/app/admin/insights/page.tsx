import Link from "next/link";
import type { InsightStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { wardScopeWhere } from "@/lib/authz";
import { getSetting } from "@/lib/settings";
import { maybeRefreshInsights } from "@/lib/services/insights";
import { fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, EmptyState } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";
import { AiInsightsPanel } from "@/components/admin/AiInsightsPanel";
import { aiStatus, listAiReports } from "@/lib/services/ai-insights";
import { districtScopeWhere, type Actor } from "@/lib/authz";
import type { AiContext, AiInsight } from "@/lib/domain/ai";

export const metadata = { title: "Insights" };

export default async function InsightsPage({ searchParams }: { searchParams: { status?: string; rule?: string; ai?: string } }) {
  const actor = await requireAdminPage("/admin/insights");
  await maybeRefreshInsights();
  const status = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"].includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const where: Prisma.InsightWhereInput = {
    ...(actor.scope.all ? {} : { ward: wardScopeWhere(actor) }),
    status: status ? (status as InsightStatus) : { in: ["OPEN", "ACKNOWLEDGED"] },
    ...(searchParams.rule ? { ruleKey: searchParams.rule } : {}),
  };
  const [items, lastRun] = await Promise.all([
    prisma.insight.findMany({ where, orderBy: [{ severity: "desc" }, { generatedAt: "desc" }], take: 100, include: { ward: { select: { number: true, localBody: { select: { name: true } } } }, category: { select: { name: true } } } }),
    getSetting<string | null>("insights.lastRun", null),
  ]);
  return (
    <>
      <AdminTopBar actor={actor} title="Insights" subtitle="Rule-based alerts generated from complaint records" />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="admin-panel p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[["", "Active"], ["ACKNOWLEDGED", "Acknowledged"], ["RESOLVED", "Auto-resolved"], ["DISMISSED", "Dismissed"]].map(([v, l]) => <Link key={l} href={v ? `?status=${v}` : "?"} className={(status ?? "") === v ? "btn-primary btn-sm" : "btn-outline btn-sm"}>{l}</Link>)}
            <span className="ml-auto text-xs text-ink-500">Last run: {lastRun ? fmtDateTime(lastRun) : "never"}</span>
            <ActionButton action="/api/admin/insights" successMessage="Insights refreshed." className="btn-outline btn-sm">Run rules now</ActionButton>
          </div>
          {items.length === 0 ? <EmptyState title="Nothing here">No insights match this view.</EmptyState> : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className={`rounded-lg border-l-4 p-3 shadow-card ${i.severity === "HIGH" ? "border-l-alert-600" : i.severity === "MEDIUM" ? "border-l-saffron-500" : "border-l-brand-400"}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`badge ${i.severity === "HIGH" ? "bg-alert-100 text-alert-600" : "bg-saffron-100 text-saffron-600"}`}>{i.severity}</span>
                    <p className="font-semibold text-ink-900">{i.title} — Ward {i.ward?.number}, {i.ward?.localBody.name}</p>
                    <span className="ml-auto text-xs text-ink-500">Generated {fmtDateTime(i.generatedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{i.summary}</p>
                  <p className="mt-1 text-xs text-ink-500">Evidence: {Object.entries(i.evidence as Record<string, unknown>).map(([k, v]) => `${k} ${v}`).join(", ")}</p>
                  <p className="mt-1 text-sm"><strong>Suggested action:</strong> {i.suggestedAction}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={i.link} className="btn-primary btn-sm">Open related complaints</Link>
                    {i.status === "OPEN" && <ActionButton action="/api/admin/insights" method="PATCH" body={{ id: i.id, status: "ACKNOWLEDGED" }} successMessage="Acknowledged.">Acknowledge</ActionButton>}
                    {i.status !== "DISMISSED" && i.status !== "RESOLVED" && <ActionButton action="/api/admin/insights" method="PATCH" body={{ id: i.id, status: "DISMISSED" }} successMessage="Dismissed." confirm={{ title: "Dismiss this insight?", message: "It will stay dismissed until you reopen it, even if the rule keeps firing.", confirmLabel: "Dismiss" }}>Dismiss</ActionButton>}
                    {i.status === "DISMISSED" && <ActionButton action="/api/admin/insights" method="PATCH" body={{ id: i.id, status: "OPEN" }} successMessage="Reopened.">Reopen</ActionButton>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <Card variant="admin" title="How these are generated">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li><strong>Water supply risk:</strong> water complaints in 30 days are rising sharply, or many remain unresolved.</li>
              <li><strong>Road repairs:</strong> several road complaints are past their service deadline.</li>
              <li><strong>Drainage review:</strong> repeated drainage complaints within 90 days.</li>
              <li><strong>Service backlog:</strong> most open complaints in another category are overdue.</li>
            </ul>
            <p className="mt-2 text-xs text-ink-500">Thresholds are configurable. Conditions that stop holding are closed automatically. These are not trained forecasts.</p>
          </Card>
        </div>
      </div>
      <AiSection actor={actor} district={searchParams.ai} />
    </>
  );
}

async function AiSection({ actor, district }: { actor: Actor; district?: string }) {
  const status = aiStatus();
  const districts = await prisma.district.findMany({ where: districtScopeWhere(actor), orderBy: { name: "asc" }, select: { id: true, name: true } });
  const chosen = district || (actor.scope.all ? undefined : districts[0]?.id);
  const reports = await listAiReports(actor, chosen);
  const latest = reports[0];
  const insights = (latest?.insights ?? []) as unknown as AiInsight[];
  const ctx = latest?.context as unknown as AiContext | undefined;
  const sev = { HIGH: "bg-alert-100 text-alert-600", MEDIUM: "bg-saffron-100 text-saffron-600", LOW: "bg-leaf-100 text-leaf-700" } as const;
  return (
    <section id="ai" className="mt-4 scroll-mt-24" aria-labelledby="ai-title">
      <div className="admin-panel p-5">
        <div>
          <h2 id="ai-title" className="font-display text-xl font-semibold text-ink-900">AI development analysis</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-700">A language model reviews aggregated complaint, score, project and Local Government Directory figures and suggests priorities and preventive actions. It never sees names, contact details, addresses or photos. Treat results as advice to verify, not decisions.</p>
          <div className="mt-4"><AiInsightsPanel districts={districts} defaultDistrict={chosen} allowStateWide={actor.scope.all} available={status.available} reason={status.reason} /></div>
        </div>
      </div>
      {latest && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-500">{latest.district ? `${latest.district.name} district` : "Andhra Pradesh"}, generated {fmtDateTime(latest.createdAt)} by {latest.createdBy.name} with {latest.provider}/{latest.model}{latest.status !== "OK" && latest.error ? `. Error: ${latest.error}` : ""}</p>
          {insights.length === 0 ? <div className="admin-panel p-4"><EmptyState title="The model returned no usable insights">{latest.error ?? "Try again, or use a larger model."}</EmptyState></div> : (
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {insights.map((i, n) => (
                <li key={n} className="admin-panel p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className={`badge ${sev[i.severity]}`}>{i.severity}</span><span className="badge bg-brand-50 text-brand-700">{i.horizon}</span><span className="text-xs text-ink-500">confidence: {i.confidence}</span></div>
                  <h3 className="mt-2 font-semibold text-ink-900">{i.title}</h3>
                  <p className="text-xs font-medium text-brand-600">{i.area}{i.category ? `, ${i.category}` : ""}</p>
                  <p className="mt-2 text-sm text-ink-700"><strong className="text-ink-900">Evidence:</strong> {i.evidence}</p>
                  <p className="mt-1 text-sm text-ink-700"><strong className="text-ink-900">Recommended:</strong> {i.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
          {ctx && (
            <details className="admin-panel mt-3 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Data sent to the model ({ctx.areas.length} areas, {ctx.structure.wards.toLocaleString("en-IN")} wards, {ctx.structure.villages.toLocaleString("en-IN")} villages)</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-[11px]">{JSON.stringify(ctx, null, 2)}</pre>
            </details>
          )}
          {reports.length > 1 && <p className="mt-2 text-xs text-ink-500">Earlier reports: {reports.slice(1).map((r) => fmtDateTime(r.createdAt)).join(", ")}</p>}
        </div>
      )}
    </section>
  );
}
