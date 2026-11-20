import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BarChart3, Brain, CheckCircle2, Cpu, Eye, Handshake, Landmark, Lightbulb, MapPin, RoadHorizon, Rocket, ShieldCheck, Star, Target, Users,
} from "@/components/app-icons";
import { prisma } from "@/lib/db";
import { getSiteContent } from "@/lib/settings";
import { geoPathFor } from "@/lib/services/geo";
import { landingData } from "@/lib/services/public";
import Image from "next/image";
import { HeroMap } from "@/components/brand/HeroMap";
import { AssetHint } from "@/components/site/AssetHint";
import { CardBackdrop } from "@/components/site/CardBackdrop";
import { siteJsonLd } from "@/lib/site";
import { ASSET } from "@/lib/assets";
import { StateMap, boundariesInstalled } from "@/components/brand/StateMap";
import { TricolorRibbon } from "@/components/brand/Logo";
import { CategoryIcon } from "@/components/icons";
import { Card, Change, Donut, EmptyState } from "@/components/ui";
import { LandingReportWidget } from "@/components/client/LandingReportWidget";
import { WardSwitcher } from "@/components/client/WardSwitcher";

const FEATURE_STRIP = [
  { icon: Users, title: "Citizen Portal", text: "Report local problems, track progress", href: "/report" },
  { icon: Cpu, title: "Development Intelligence", text: "Spot risks & prioritise development", href: "/features#insights" },
  { icon: Landmark, title: "Government Dashboard", text: "Monitor progress & plan better", href: "/dashboard" },
  { icon: ShieldCheck, title: "Transparent Governance", text: "Ensure accountability and trust", href: "/about#transparency" },
];
const KEY_FEATURES = ["Problem Reporting with Photos & Videos", "Community Support for Reports", "Development Intelligence & Risk Alerts", "Ward Development Score", "Project Monitoring & Transparency"];
const ROADMAP = ["Research & Planning", "Prototype Development", "Pilot in AP", "AI Integration", "India Expansion"];
const barColor = (v: number | null) => (v == null ? "rgb(var(--track))" : v >= 80 ? "#41c03b" : v >= 72 ? "#ffa918" : "#de0d22");
const ICON_COLOR: Record<string, string> = { water: "#108efc", sanitation: "#108efc", healthcare: "#de0d22" };

export default async function HomePage({ searchParams }: { searchParams: { ward?: string } }) {
  const [content, categories, data] = await Promise.all([
    getSiteContent(),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } }),
    landingData(searchParams.ward),
  ]);
  const wd = data?.wardDash;
  const heroImg = ASSET.heroCitizens(), visionImg = ASSET.vision(), partnersImg = ASSET.partners();
  const featuredPath = data ? await geoPathFor({ wardId: data.ward.id }) : undefined;

  return (
    <>
      {/* Hero, as in the reference: the photograph fills the whole band and the text sits on its left
          over a soft wash. Below 1024 px the text comes first and the photo shows in the band beneath it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd(content) }} />
      <section className="bg-hero relative isolate overflow-hidden" aria-labelledby="hero-title">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {heroImg
            ? <><Image src={heroImg} alt="" fill priority sizes="100vw" quality={72} className="object-cover object-[68%_center]" /><div className="hero-scrim absolute inset-0" /></>
            : <HeroMap />}
        </div>
        {!heroImg && <>
          <AssetHint file="hero/citizens.webp" size="1920×800 or larger, landscape" className="bottom-auto top-3 hidden lg:flex" />
          <AssetHint compact file="hero/citizens.webp" size="1920×800" className="bottom-auto top-1.5 lg:hidden" />
        </>}
        <div className="mx-auto max-w-page px-4 pb-56 pt-8 sm:pb-64 md:px-10 lg:pb-32 lg:pt-10">
          <div className="max-w-[560px]">
            <h1 id="hero-title" className="font-display text-[30px] font-bold leading-[1.15] text-navy-700 sm:text-[38px] xl:text-[44px]">{content.heroTitle}</h1>
            <p className="mt-3 max-w-[460px] text-[16px] leading-snug text-ink-900 md:text-[18px]">{content.heroText}</p>
            <Link href="/register" className="btn-primary mt-5 h-11 px-7 text-[16px]">Get started <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      {/* Feature strip overlaps only the hero's bottom padding (the photo band), never its text. */}
      <div className="relative z-10 mx-auto -mt-14 max-w-page px-4 md:px-10">
        <ul className="grid grid-cols-1 gap-y-4 rounded-[22px] border border-line/60 bg-surface px-4 py-4 shadow-float sm:grid-cols-2 xl:grid-cols-4 xl:py-5">
          {FEATURE_STRIP.map((f, i) => (
            <li key={f.title} className={`flex min-w-0 items-center gap-3 px-2 xl:px-5 ${i > 0 ? "xl:border-l xl:border-line" : ""}`}>
              <f.icon weight="duotone" className="h-12 w-12 shrink-0 rounded-full bg-brand-50 p-2.5 text-brand-600 2xl:h-14 2xl:w-14" aria-hidden="true" />
              <Link href={f.href} className="group min-w-0">
                <span className="block font-display text-[16px] font-semibold leading-tight text-navy-700 group-hover:text-brand-600 2xl:text-[18px]">{f.title}</span>
                <span className="mt-0.5 block text-[14px] leading-tight text-ink-700 2xl:text-[15px]">{f.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Row 1 — ≥1280px: report | ward dashboard | insights (as in the reference design).
          768–1279px: report | insights, then the ward dashboard at full width. Phones: stacked. */}
      <div className="mx-auto mt-5 grid max-w-page gap-4 px-4 md:grid-cols-2 md:px-5 xl:grid-cols-[minmax(270px,320px)_minmax(0,1fr)_minmax(300px,400px)] 2xl:grid-cols-[345px_minmax(0,1fr)_460px]">
        <Card title="Report a Problem" icon={<MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />} id="report" className="md:order-1" bodyClassName="flex flex-col p-3 pt-2.5">
          <LandingReportWidget categories={categories} defaultPath={featuredPath} />
        </Card>

        <Card id="ward-dashboard" title="Ward Development Dashboard" icon={<BarChart3 className="h-5 w-5 shrink-0" aria-hidden="true" />}
          action={data ? <WardSwitcher wards={data.wards} value={data.ward.id} /> : null}
          className="md:order-3 md:col-span-2 xl:order-2 xl:col-span-1" bodyClassName="cq p-3">
          {!data || !wd ? (
            <EmptyState title="No ward data yet">Run the database seed or add wards in the admin settings.</EmptyState>
          ) : (
            <div className="ward-layout">
              <div className="ward-donut flex flex-col items-center">
                <Donut value={wd.kpis.devScore} size={150} stroke={16} label={`Development score ${wd.kpis.devScore ?? "insufficient data"}`}>
                  <span className="font-display text-[32px] font-bold leading-none text-navy-700">{wd.kpis.devScore == null ? "—" : `${Math.round(wd.kpis.devScore)}%`}</span>
                  <span className="mt-1 text-[13px] font-semibold leading-tight text-ink-900">Development<br />Score</span>
                </Donut>
                <div className="mt-2 text-center"><Change value={wd.kpis.devScoreChange} suffix=" pts" label="" /><p className="text-[12px] text-ink-700">vs last month</p></div>
                {wd.scoreAsOf && <p className="mt-0.5 text-[11px] text-ink-500">Data: {wd.scoreAsOf}</p>}
              </div>
              <ul className="ward-bars space-y-2 rounded-lg border border-line px-3 py-2.5 shadow-card">
                {wd.indicators.map((ind) => (
                  <li key={ind.key} className="grid grid-cols-[22px_minmax(0,1fr)_42px] items-center gap-x-2">
                    <CategoryIcon name={ind.icon} className="h-5 w-5 text-ink-700" color={ICON_COLOR[ind.icon]} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium leading-tight text-ink-900">{ind.name}</p>
                      <div className="mt-1 h-[6px] w-full rounded-full bg-track"><div className="h-full rounded-full" style={{ width: `${ind.score ?? 0}%`, background: barColor(ind.score) }} /></div>
                    </div>
                    <span className="text-right text-[13.5px] font-semibold tabular-nums text-ink-900">{ind.score == null ? "—" : `${ind.score}%`}</span>
                  </li>
                ))}
              </ul>
              <figure className="ward-map flex min-w-0 flex-col">
                <div className="min-h-0 flex-1">
                  <StateMap className="h-full w-full" highlightLgd={data.ward.localBody.district.lgdCode} pin={data.ward.localBody.district.latitude != null && data.ward.localBody.district.longitude != null ? { lon: data.ward.localBody.district.longitude, lat: data.ward.localBody.district.latitude, title: `${data.ward.localBody.name}, ${data.ward.localBody.district.name} district` } : undefined} />
                </div>
                <figcaption className="mt-1 flex items-end justify-between gap-2">
                  <span className="text-[10px] leading-tight text-ink-500">{boundariesInstalled() ? <><Link href={`/map?district=${data.ward.localBody.districtId}`} className="link font-semibold">Explore the map</Link><br />{data.ward.localBody.district.name} highlighted</> : <>Illustrative outline,<br />not to scale</>}</span>
                  <span className="text-right font-display text-[16px] font-semibold leading-tight text-navy-700">{data.ward.localBody.district.state.name}</span>
                </figcaption>
              </figure>
            </div>
          )}
        </Card>

        <Card title="Insights & Risk Alerts" icon={<Brain className="h-5 w-5 shrink-0" aria-hidden="true" />} id="insights" className="md:order-2 xl:order-3" bodyClassName="cq flex flex-col p-3">
          {!data || data.alerts.length === 0 ? (
            <EmptyState title="No active alerts">The rule-based checks found no unusual complaint patterns in this district.</EmptyState>
          ) : (
            <>
              <div className="split-2 flex-1">
                <div>
                  <h3 className="mb-1.5 text-[15px] font-semibold text-ink-900">Risk Alerts</h3>
                  <ul className="divide-y divide-line">
                    {data.alerts.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 py-1.5">
                        <AlertTriangle className={`mt-0.5 h-6 w-6 shrink-0 text-white ${a.severity === "HIGH" ? "fill-alert-600" : "fill-saffron-500"}`} aria-hidden="true" />
                        <p className={`text-[15px] leading-tight ${a.severity === "HIGH" ? "text-alert-600" : "text-saffron-600"}`}>{a.label}<br />({a.severity === "HIGH" ? "High" : "Medium"} Risk)</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1.5 text-[15px] font-semibold text-ink-900">Recommended Actions</h3>
                  <ul className="space-y-3 pt-1">
                    {data.alerts.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-[15px] leading-tight text-ink-900"><CheckCircle2 className="h-6 w-6 shrink-0 text-leaf-600" aria-hidden="true" />{a.action}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-3 rounded-md bg-brand-50 px-3 py-2 text-[14px] text-ink-900">
                <Lightbulb className="h-7 w-7 shrink-0 fill-amber-500 text-saffron-600" aria-hidden="true" />
                <span><strong>Watch now:</strong> rising water complaints in {data.districtDash.waterRiskWards} ward{data.districtDash.waterRiskWards === 1 ? "" : "s"} ({data.ward.localBody.district.name}). <span className="text-ink-500">Rule-based, not a forecast.</span></span>
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Row 2 — ≥1536px: four columns; 768–1535px: 2 × 2; phones: stacked. */}
      <div className="mx-auto mb-6 mt-4 grid max-w-page gap-4 px-4 md:grid-cols-2 md:px-5 2xl:grid-cols-[365px_290px_minmax(0,1fr)_370px]">
        <Card title="Our Vision & Mission" icon={<Target className="h-5 w-5 shrink-0" aria-hidden="true" />} bodyClassName="relative isolate overflow-hidden p-0">
          <CardBackdrop src={visionImg} file="landing/vision.webp" size="800×600" fallback={<RoadHorizon weight="duotone" className="h-24 w-24" />} />
          <div className="min-h-[150px]">
            <div className="max-w-[64%] space-y-2 p-3">
              <div><p className="flex items-center gap-1.5 font-semibold text-brand-600"><Eye className="h-4 w-4" aria-hidden="true" />Vision</p><p className="text-[13px] leading-snug text-ink-900">A digitally connected India where every Gram Panchayat and Municipality has reliable information about its development needs.</p></div>
              <div><p className="flex items-center gap-1.5 font-semibold text-brand-600"><Rocket className="h-4 w-4" aria-hidden="true" />Mission</p><p className="text-[13px] leading-snug text-ink-900">Identify problems, analyse infrastructure, prioritise development and connect citizens with government.</p></div>
            </div>
          </div>
        </Card>

        <Card title="Our Key Features" icon={<Star className="h-5 w-5 shrink-0" aria-hidden="true" />} bodyClassName="px-4 py-3">
          <ul className="space-y-2">
            {KEY_FEATURES.map((k) => <li key={k} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ink-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-600" aria-hidden="true" />{k}</li>)}
          </ul>
        </Card>

        <Card title="Development Roadmap" icon={<Star className="h-5 w-5 shrink-0" aria-hidden="true" />} bodyClassName="cq px-3 py-3">
          <ol className="roadmap">
            <span className="roadmap-line" aria-hidden="true" />
            {ROADMAP.map((r, i) => (
              <li key={r} className="roadmap-step">
                <span className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-[15px] font-bold text-white ring-4 ring-surface">{i + 1}</span>
                <span className="text-[13px] leading-tight text-ink-900">{r}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line pt-2 text-center font-display text-[16px] font-semibold text-navy-700">
            <TricolorRibbon className="hidden h-7 w-14 sm:block" />Together for a Developed India<TricolorRibbon className="hidden h-7 w-14 -scale-x-100 sm:block" />
          </p>
        </Card>

        <Card title="Partner with Us" icon={<Handshake className="h-5 w-5 shrink-0" aria-hidden="true" />} bodyClassName="relative isolate overflow-hidden p-0">
          <CardBackdrop src={partnersImg} file="landing/partners.webp" size="800×600" fallback={<Landmark weight="duotone" className="h-24 w-24" />} />
          <div className="min-h-[150px]">
            <div className="max-w-[66%] p-3">
              <p className="mb-2 text-[14.5px] font-semibold text-ink-900">Let&apos;s build a better tomorrow together.</p>
              <ul className="space-y-1">
                {["Government Collaboration", "CSR Partnerships", "Innovation Support"].map((p) => <li key={p} className="flex items-start gap-2 text-[14px] text-ink-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-600" aria-hidden="true" />{p}</li>)}
              </ul>
              <Link href="/contact?type=GOVERNMENT" className="btn-orange mt-3 rounded-lg px-5 py-2 text-[15px]">Contact Us <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
