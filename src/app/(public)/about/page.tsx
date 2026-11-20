import Link from "next/link";
import { CheckCircle2, Eye, Rocket } from "@/components/app-icons";
import { getSiteContent } from "@/lib/settings";
import { CategoryIcon } from "@/components/icons";
import { DemoNotice } from "@/components/ui";

export const metadata = { title: "About", description: "Who builds Smart Ward India, why ward-level data matters, and how the platform supports Gram Panchayats and municipalities in Andhra Pradesh.", alternates: { canonical: "/about" } };

const SECTORS: Array<[string, string, string]> = [
  ["water", "Drinking Water", "Water shortages and irregular supply"],
  ["roads", "Roads", "Damaged roads and poor connectivity"],
  ["drainage", "Drainage", "Blocked drains and inadequate drainage"],
  ["sanitation", "Sanitation", "Garbage accumulation and waste management"],
  ["electricity", "Electricity", "Streetlight failures"],
  ["education", "Education", "School infrastructure requirements"],
  ["healthcare", "Healthcare", "Lack of nearby medical facilities"],
  ["employment", "Employment", "Limited local employment opportunities"],
  ["agriculture", "Agriculture", "Irrigation and agricultural infrastructure"],
  ["environment", "Environment", "Flooding and pollution"],
];
const MISSION = [
  "Identify problems faced by citizens.",
  "Analyse rural and urban infrastructure.",
  "Anticipate potential development challenges.",
  "Help prioritise local development requirements.",
  "Connect citizens with government authorities.",
  "Promote transparency in development monitoring.",
];
const ROADMAP: Array<[string, string[]]> = [
  ["Research and Planning", ["Understand local development problems", "Identify government stakeholders", "Prepare the project proposal"]],
  ["Prototype Development", ["Build the citizen portal", "Develop the government dashboard", "Create ward-level reports"]],
  ["Pilot Implementation", ["Select one district in Andhra Pradesh", "Identify participating Panchayats and Municipality wards", "Collect verified local information and demonstrate the platform"]],
  ["AI Integration", ["Introduce predictive analytics", "Analyse recurring infrastructure problems", "Generate development recommendations"]],
  ["Expansion", ["Expand across Andhra Pradesh", "Establish additional government partnerships", "Gradually expand across India"]],
];

export default async function AboutPage() {
  const c = await getSiteContent();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mt-1 text-3xl font-bold text-navy-700 md:text-4xl">About Smart Ward India</h1>
      <p className="mt-2 font-display text-lg italic text-navy-700">{c.taglineOne} {c.taglineTwo}</p>

      <section className="mt-6 space-y-3 text-[16px] leading-relaxed text-ink-700">
        <p>Smart Ward India is a technology-driven civic development platform that connects citizens, government departments and local representatives.</p>
        <p>Our objective is to identify development challenges in rural and urban areas, analyse local infrastructure requirements, anticipate potential problems and communicate development priorities to the appropriate government authorities — using technology, data and public participation to support better local development planning.</p>
        <p>Our initial focus is Andhra Pradesh, with a vision of nationwide expansion. We intend to work alongside existing government systems rather than replace them.</p>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Eye className="h-5 w-5 text-brand-600" aria-hidden="true" />Our vision</h2>
          <p className="mt-2 text-ink-700">To build a digitally connected India where every Gram Panchayat and Municipality has access to reliable information about its development requirements.</p>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Rocket className="h-5 w-5 text-brand-600" aria-hidden="true" />Our mission</h2>
          <ul className="mt-2 space-y-1.5">{MISSION.map((m) => <li key={m} className="flex items-start gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{m}</li>)}</ul>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="sectors">
        <h2 id="sectors" className="text-2xl font-semibold">Problems we aim to address</h2>
        <p className="mt-1 text-ink-500">Residents can report problems in each of these sectors today.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTORS.map(([icon, name, text]) => (
            <li key={name} className="card flex items-start gap-3 p-4">
              <span className="rounded-lg bg-brand-50 p-2"><CategoryIcon name={icon} className="h-5 w-5 text-brand-600" /></span>
              <span><span className="block font-semibold text-ink-900">{name}</span><span className="text-sm text-ink-700">{text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section id="transparency" className="mt-10 card p-5" aria-labelledby="transparency-title">
        <h2 id="transparency-title" className="text-xl font-semibold">Transparency and privacy</h2>
        <p className="mt-2 text-ink-700">The <Link className="link" href="/dashboard">public dashboard</Link> shows aggregated figures for every ward — complaints reported and resolved, development scores and public projects. Residents can choose to let neighbours see and support a report; even then only its title, category and status are shown. Names, contact details, addresses, exact locations, photos and internal notes are never published.</p>
      </section>

      <section className="mt-10" aria-labelledby="roadmap">
        <h2 id="roadmap" className="text-2xl font-semibold">Implementation roadmap</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-5">
          {ROADMAP.map(([title, items], i) => (
            <li key={title} className="card p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-display font-bold text-white">{i + 1}</span>
              <p className="mt-2 font-semibold text-ink-900">Phase {i + 1}: {title}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-700">{items.map((x) => <li key={x}>{x}</li>)}</ul>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-ink-500">Today the platform provides rule-based analytics on recorded complaints; predictive models are planned for Phase 4 once enough verified local data exists.</p>
      </section>

      <section className="mt-10 card p-5" aria-labelledby="leadership">
        <h2 id="leadership" className="text-xl font-semibold">Leadership</h2>
        <p className="mt-2 font-semibold text-ink-900">{c.founderName ? `${c.founderName} — ${c.founderTitle}` : c.founderTitle}</p>
        <p className="mt-1 text-ink-700">{c.founderBio}</p>
      </section>

      <section className="mt-10 rounded-card bg-navy-900 p-6 text-white" aria-labelledby="commitment">
        <h2 id="commitment" className="text-xl font-semibold text-white">Our commitment</h2>
        <p className="mt-2 text-white/90">We believe development should begin by understanding people&apos;s actual problems. Every village deserves proper infrastructure. Every municipality deserves effective development planning. Every citizen deserves an opportunity to communicate their concerns.</p>
        <p className="mt-3 font-display font-semibold italic">{c.footerSlogan}</p>
      </section>

      <DemoNotice className="mt-8" />
    </div>
  );
}
