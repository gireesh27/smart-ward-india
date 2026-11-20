import Link from "next/link";
import { Building2, CheckCircle2, HandCoins, Landmark, Lightbulb } from "@/components/app-icons";

export const metadata = { title: "Partners", description: "How government departments, CSR partners and innovators can work with Smart Ward India on ward-level development in Andhra Pradesh.", alternates: { canonical: "/partners" } };

const TARGETS = [
  "Ministry of Panchayati Raj",
  "Andhra Pradesh Panchayat Raj Department",
  "Andhra Pradesh Municipal Administration Department",
  "District Collector Offices",
  "Gram Panchayats",
  "Municipalities and Municipal Corporations",
  "Technology and innovation organisations",
  "Eligible CSR partners",
];
const PILOT = ["Local problem identification", "Infrastructure assessment", "Development prioritisation", "Public participation", "Development monitoring"];
const REVENUE = ["Government software contracts", "Annual software subscriptions", "Technology implementation services", "Analytics and reporting", "Software maintenance and support", "Technology licensing"];
const TYPES = [
  { icon: Building2, title: "Government collaboration", type: "GOVERNMENT", text: "Panchayats, municipalities and district offices can pilot the platform for their wards, with their own departments, categories and scoring targets." },
  { icon: HandCoins, title: "CSR partnerships", type: "CSR", text: "Fund ward-level development projects and follow their milestones and spending on the public dashboard." },
  { icon: Lightbulb, title: "Innovation support", type: "INNOVATION", text: "Researchers and technology organisations can help improve indicators, analytics and accessibility." },
];

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-10 md:px-8">
      <h1 className="text-3xl font-bold text-navy-700 md:text-4xl">Partner with us</h1>
      <p className="mt-2 max-w-2xl text-ink-700">Let&apos;s build a better tomorrow together. Smart Ward India seeks opportunities to collaborate with government departments and local administrative bodies.</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="pilot">
          <h2 id="pilot" className="flex items-center gap-2 text-xl font-semibold"><Landmark className="h-5 w-5 text-brand-600" aria-hidden="true" />Government partnership proposal</h2>
          <p className="mt-2 text-ink-700">We propose a pilot in one district of Andhra Pradesh, with participating Gram Panchayats and Municipality wards, to demonstrate how digital technology can support:</p>
          <ul className="mt-3 space-y-1.5">{PILOT.map((p) => <li key={p} className="flex items-start gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{p}</li>)}</ul>
          <p className="mt-3 text-ink-700">We intend to work alongside existing government systems rather than replace them.</p>
          <Link href="/contact?type=GOVERNMENT" className="btn-orange mt-4">Discuss a pilot</Link>
        </section>
        <section className="card p-5" aria-labelledby="targets">
          <h2 id="targets" className="text-xl font-semibold">Who we aim to work with</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{TARGETS.map((t) => <li key={t} className="flex items-start gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{t}</li>)}</ul>
          <p className="mt-3 text-xs text-ink-500">These are prospective partners. Listing an organisation here does not imply an existing partnership, endorsement or affiliation.</p>
        </section>
      </div>

      <section className="mt-8 card p-5" aria-labelledby="model">
        <h2 id="model" className="text-xl font-semibold">How we work with institutions</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_320px]">
          <ul className="grid gap-2 sm:grid-cols-2">{REVENUE.map((r) => <li key={r} className="flex items-start gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{r}</li>)}</ul>
          <p className="rounded-md bg-leaf-100 p-4 font-semibold text-leaf-700">Citizen problem reporting is, and will remain, free.</p>
        </div>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {TYPES.map((t) => (
          <section key={t.type} className="card flex flex-col p-5">
            <t.icon className="h-9 w-9 text-saffron-600" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">{t.title}</h2>
            <p className="mt-1 flex-1 text-sm text-ink-700">{t.text}</p>
            <Link href={`/contact?type=${t.type}`} className="btn-orange mt-4 self-start">Start a conversation</Link>
          </section>
        ))}
      </div>
    </div>
  );
}
