import Link from "next/link";
import { BarChart3, Brain, CheckCircle2, ClipboardList, Landmark, Users } from "@/components/app-icons";
import { prisma } from "@/lib/db";

export const metadata = { title: "Features", description: "Complaint reporting with photos, ward development scores, district maps, rule-based alerts, project tracking and reports for local governments.", alternates: { canonical: "/features" } };

const BLOCKS = [
  { id: "citizen-portal", icon: Users, title: "A. Citizen Portal", items: ["Register local problems in ten sectors", "Upload photographs and videos as evidence", "Select your Gram Panchayat or Municipality ward", "Support existing problem reports instead of duplicating them", "Track complaint progress and review the resolution"] },
  { id: "insights", icon: Brain, title: "B. Development Intelligence", items: ["Analyses historical complaints for every ward", "Identifies recurring infrastructure problems (for example repeated drainage complaints)", "Flags risks such as rising water complaints and overdue road repairs", "Points to areas that need development attention", "Recommends a preventive action for each alert, linked to the supporting records"] },
  { id: "dashboard", icon: Landmark, title: "C. Government Dashboard", items: ["Review ward-level problems within your jurisdiction", "Monitor complaint resolution and service deadlines", "View and export development reports (CSV, PDF)", "Identify infrastructure priorities by ward and sector", "Monitor development projects and schedule review meetings"] },
  { id: "monitoring", icon: ClipboardList, title: "D. Development Monitoring", items: ["Proposed (planned) development works", "Ongoing projects with milestone-based progress", "Completed projects", "Pending requirements from open citizen reports", "Public feedback and satisfaction ratings"] },
];
const STACK: Array<[string, string]> = [
  ["Web application", "Next.js (React) with TypeScript — one codebase, fast on low-end phones"],
  ["Database", "PostgreSQL with Prisma — relational, auditable records"],
  ["Analytics", "Rule-based insight engine today; Python predictive models planned for Phase 4"],
  ["Maps", "OpenStreetMap with Leaflet"],
  ["Visualisation", "Recharts"],
  ["Authentication", "Database-backed sessions, email verification, role and area permissions"],
  ["Files", "Private storage for photos, videos and documents (local disk or S3-compatible cloud)"],
  ["Hosting", "Docker containers; deployable to government-approved (MeitY-empanelled) cloud or a state data centre"],
];

export default async function FeaturesPage() {
  const indicators = await prisma.indicatorDefinition.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const total = indicators.reduce((s, i) => s + i.weight, 0) || 1;
  return (
    <div className="mx-auto max-w-page px-4 py-10 md:px-8">
      <h1 className="text-3xl font-bold text-navy-700 md:text-4xl">Our technology platform</h1>
      <p className="mt-2 max-w-2xl text-ink-700">Everything a ward needs to move from complaint to resolution — and to show the public what changed.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {BLOCKS.map((b) => (
          <section key={b.id} id={b.id} className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><b.icon className="h-6 w-6 rounded-md bg-brand-50 p-1 text-brand-600" aria-hidden="true" />{b.title}</h2>
            <ul className="mt-3 space-y-1.5">{b.items.map((x) => <li key={x} className="flex items-start gap-2 text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />{x}</li>)}</ul>
            {b.id === "insights" && <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-ink-700">Today these are transparent, rule-based checks on recorded data — every alert shows the numbers behind it. Predictive analytics are planned for roadmap Phase 4.</p>}
          </section>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="assessment">
        <h2 id="assessment" className="flex items-center gap-2 text-2xl font-semibold"><BarChart3 className="h-6 w-6 text-brand-600" aria-hidden="true" />Ward Development Assessment</h2>
        <p className="mt-1 max-w-3xl text-ink-700">Each ward receives a development score from measurable indicators. These are proposed initial weights and will be validated with development experts; administrators can adjust them, and every score is recalculated from stored data.</p>
        <div className="card mt-4 overflow-x-auto">
          <table className="table min-w-[560px]">
            <caption className="sr-only">Development indicators and weights</caption>
            <thead><tr><th scope="col">Indicator</th><th scope="col">How it is measured</th><th scope="col" className="text-right">Weight</th></tr></thead>
            <tbody>
              {indicators.map((i) => <tr key={i.id}><td className="font-medium text-ink-900">{i.name}</td><td>{i.unit}</td><td className="text-right tabular-nums">{Math.round((i.weight / total) * 100)}%</td></tr>)}
              <tr><td className="font-semibold text-ink-900">Total</td><td /><td className="text-right font-semibold">100%</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-ink-500">When a ward has too little data, the platform shows “insufficient data” instead of estimating a score.</p>
      </section>

      <section className="mt-10" aria-labelledby="stack">
        <h2 id="stack" className="text-2xl font-semibold">Technology</h2>
        <dl className="card mt-4 divide-y divide-line">
          {STACK.map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]"><dt className="font-semibold text-ink-900">{k}</dt><dd className="text-ink-700">{v}</dd></div>)}
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="btn-primary">Create a citizen account</Link><Link href="/dashboard" className="btn-outline">View the public dashboard</Link></div>
    </div>
  );
}
