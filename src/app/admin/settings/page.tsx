import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { ROLE_LABEL, type Actor } from "@/lib/authz";
import { getMinCoverage, getSiteContent } from "@/lib/settings";
import { geoPathFor, geoSummary } from "@/lib/services/geo";
import { listOrg } from "@/lib/services/org";
import { listUsers } from "@/lib/services/users";
import { listInquiries } from "@/lib/services/content";
import { GeoParentPicker, ScopePicker } from "@/components/admin/AdminPickers";
import { SortHeader } from "@/components/data/TableControls";
import { GeoPicker } from "@/components/client/GeoPicker";
import { fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, EmptyState, Pagination } from "@/components/ui";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { ActionButton } from "@/components/client/ActionButton";
import { ScoringForm } from "@/components/admin/ScoringForm";
import { AppearanceSettings, ChangePasswordForm, ProfileForm } from "@/components/site/ProfileForms";

export const metadata = { title: "Settings" };

const TABS: Array<{ key: string; label: string; roles: Actor["role"][] }> = [
  { key: "profile", label: "Profile & notifications", roles: ["WARD_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"] },
  { key: "users", label: "Users & roles", roles: ["DISTRICT_ADMIN", "SUPER_ADMIN"] },
  { key: "inquiries", label: "Partner inquiries", roles: ["DISTRICT_ADMIN", "SUPER_ADMIN"] },
  { key: "audit", label: "Audit log", roles: ["DISTRICT_ADMIN", "SUPER_ADMIN"] },
  { key: "geography", label: "Geography", roles: ["SUPER_ADMIN"] },
  { key: "categories", label: "Categories", roles: ["SUPER_ADMIN"] },
  { key: "scoring", label: "Scoring", roles: ["SUPER_ADMIN"] },
  { key: "content", label: "Site content", roles: ["SUPER_ADMIN"] },
];

export default async function Settings({ searchParams }: { searchParams: { tab?: string; page?: string; q?: string; lb?: string; role?: string; sort?: string } }) {
  const actor = await requireAdminPage("/admin/settings");
  const tabs = TABS.filter((t) => t.roles.includes(actor.role));
  const tab = tabs.find((t) => t.key === searchParams.tab)?.key ?? "profile";
  return (
    <>
      <AdminTopBar actor={actor} title="Settings" subtitle={`Signed in as ${ROLE_LABEL[actor.role]}`} />
      <nav aria-label="Settings sections" className="mb-4 flex flex-wrap gap-2">{tabs.map((t) => <Link key={t.key} href={`?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={tab === t.key ? "btn-primary btn-sm" : "btn-sm btn bg-white/10 text-white hover:bg-white/20"}>{t.label}</Link>)}</nav>
      {tab === "profile" && <ProfileTab actor={actor} />}
      {tab === "users" && <UsersTab actor={actor} page={Number(searchParams.page) || 1} q={searchParams.q} role={searchParams.role} sort={searchParams.sort} />}
      {tab === "inquiries" && <InquiriesTab actor={actor} />}
      {tab === "audit" && <AuditTab actor={actor} page={Number(searchParams.page) || 1} />}
      {tab === "geography" && <GeographyTab lb={searchParams.lb} />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "scoring" && <ScoringTab />}
      {tab === "content" && <ContentTab />}
    </>
  );
}

async function ProfileTab({ actor }: { actor: Actor }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true, email: true, phone: true, wardId: true, notifyEmail: true, notifyInApp: true } });
  const path = await geoPathFor({ wardId: user.wardId });
  return <div className="grid gap-4 xl:grid-cols-2"><Card variant="admin" title="Profile & notification preferences"><ProfileForm user={user} path={path} /><AppearanceSettings /></Card><Card variant="admin" title="Change password"><ChangePasswordForm /></Card></div>;
}

async function UsersTab({ actor, page, q, role, sort }: { actor: Actor; page: number; q?: string; role?: string; sort?: string }) {
  const params = { tab: "users", q, role, sort };
  const res = await listUsers(actor, { page, q, role: role || undefined, sort });
  const roles = actor.role === "SUPER_ADMIN" ? ["CITIZEN", "WARD_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"] : ["WARD_ADMIN"];
  const scopeLabel = (u: (typeof res.items)[number]) => u.scopes.map((s) => s.ward ? `Ward ${s.ward.number}, ${s.ward.localBody.name}` : s.localBody?.name ?? s.district?.name ?? s.state?.name).join("; ");
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
      <Card variant="admin" title="Accounts" bodyClassName="p-0">
        <form method="get" className="flex gap-2 p-3"><input type="hidden" name="tab" value="users" /><label className="sr-only" htmlFor="uq">Search users</label><input id="uq" name="q" defaultValue={q} className="input" placeholder="Name or email" /><label className="sr-only" htmlFor="urole">Role</label><select id="urole" name="role" defaultValue={role ?? ""} className="select w-48"><option value="">All roles</option><option value="CITIZEN">Citizens</option><option value="WARD_ADMIN">Ward administrators</option><option value="DISTRICT_ADMIN">District administrators</option><option value="SUPER_ADMIN">Super administrators</option></select>{sort && <input type="hidden" name="sort" value={sort} />}<button className="btn-outline">Search</button></form>
        <div className="overflow-x-auto"><table className="table min-w-[720px]"><thead><tr><SortHeader label="User" field="name" current={sort} base="/admin/settings" params={params} /><SortHeader label="Role" field="role" current={sort} base="/admin/settings" params={params} /><th scope="col">Scope / ward</th><SortHeader label="Status" field="status" firstDir="desc" current={sort} base="/admin/settings" params={params} /><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{res.items.map((u) => (
            <tr key={u.id}><td>{u.name}<span className="block text-xs text-ink-500">{u.email}{!u.emailVerified ? " (unverified)" : ""}</span></td><td>{ROLE_LABEL[u.role]}</td><td className="text-xs">{u.role === "CITIZEN" ? (u.ward ? `Ward ${u.ward.number}, ${u.ward.localBody.name}` : "—") : u.role === "SUPER_ADMIN" ? "All areas" : scopeLabel(u) || "None"}</td><td>{u.isActive ? "Active" : "Deactivated"}</td>
              <td>{u.id !== actor.id && <ActionButton action={`/api/admin/users/${u.id}`} method="PATCH" body={{ isActive: !u.isActive }} successMessage="Saved." confirm={u.isActive ? { title: `Deactivate ${u.name}?`, message: "They will be signed out everywhere and cannot sign in until reactivated.", confirmLabel: "Deactivate", danger: true } : undefined}>{u.isActive ? "Deactivate" : "Reactivate"}</ActionButton>}</td></tr>
          ))}</tbody></table></div>
        <div className="px-3 pb-3"><Pagination page={res.page} pages={res.pages} href={(n) => `?tab=users&page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${role ? `&role=${role}` : ""}${sort ? `&sort=${sort}` : ""}`} /></div>
      </Card>
      <Card variant="admin" title="Create an administrator">
        <p className="mb-3 text-sm text-ink-700">The new user receives an email to choose their own password. Citizens register themselves.</p>
        <ApiForm action="/api/admin/users" successMessage="Account created and setup email sent." resetOnSuccess className="space-y-3">
          <div><label className="label" htmlFor="nu-name">Name</label><input id="nu-name" name="name" className="input" required /><FieldError name="name" /></div>
          <div><label className="label" htmlFor="nu-email">Email</label><input id="nu-email" name="email" type="email" className="input" required /><FieldError name="email" /></div>
          <div><label className="label" htmlFor="nu-role">Role</label><select id="nu-role" name="role" className="select">{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r as Actor["role"]]}</option>)}</select></div>
          <ScopePicker allowDistrict={actor.role === "SUPER_ADMIN"} />
          <FieldError name="scopeIds" />
          <SubmitButton>Create account</SubmitButton>
        </ApiForm>
      </Card>
    </div>
  );
}

async function InquiriesTab({ actor }: { actor: Actor }) {
  const items = await listInquiries(actor);
  return (
    <Card variant="admin" title="Partnership & contact inquiries">
      {items.length === 0 ? <EmptyState title="No inquiries yet" /> : (
        <ul className="space-y-4">{items.map((i) => (
          <li key={i.id} className="rounded-lg border border-line p-3">
            <p className="font-semibold">{i.name}{i.organization ? `, ${i.organization}` : ""} <span className="badge ml-2 bg-brand-50 text-brand-700">{i.type.toLowerCase()}</span></p>
            <p className="text-xs text-ink-500"><a className="link" href={`mailto:${i.email}`}>{i.email}</a>{i.phone ? `, ${i.phone}` : ""}, {fmtDateTime(i.createdAt)}</p>
            <p className="mt-2 whitespace-pre-line text-sm">{i.message}</p>
            <ApiForm action={`/api/admin/inquiries/${i.id}`} method="PATCH" successMessage="Inquiry updated." className="mt-3 flex flex-wrap items-end gap-2">
              <div><label className="label" htmlFor={`is-${i.id}`}>Status</label><select id={`is-${i.id}`} name="status" className="select w-40" defaultValue={i.status}>{["NEW", "IN_REVIEW", "RESPONDED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</select></div>
              <div className="min-w-[200px] flex-1"><label className="label" htmlFor={`in-${i.id}`}>Internal note</label><input id={`in-${i.id}`} name="internalNote" className="input" defaultValue={i.internalNote ?? ""} /></div>
              <SubmitButton className="btn-outline">Save</SubmitButton>
            </ApiForm>
          </li>
        ))}</ul>
      )}
    </Card>
  );
}

async function AuditTab({ actor, page }: { actor: Actor; page: number }) {
  const where = actor.role === "SUPER_ADMIN" ? {} : { actorId: actor.id };
  const [total, items] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 40, take: 40, include: { actor: { select: { name: true } } } })]);
  return (
    <Card variant="admin" title={actor.role === "SUPER_ADMIN" ? "Audit log" : "Your audit trail"} bodyClassName="overflow-x-auto p-0">
      <table className="table min-w-[760px] text-[13px]"><thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Summary</th></tr></thead>
        <tbody>{items.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</td><td>{a.actor?.name ?? "System"}</td><td><code>{a.action}</code></td><td>{a.entityType}</td><td>{a.summary}</td></tr>)}</tbody></table>
      <div className="px-3 pb-3"><Pagination page={page} pages={Math.max(1, Math.ceil(total / 40))} href={(n) => `?tab=audit&page=${n}`} /></div>
    </Card>
  );
}

async function GeographyTab({ lb }: { lb?: string }) {
  const [{ districts, report }, lbPath, lbWards] = await Promise.all([
    geoSummary(),
    lb ? geoPathFor({ localBodyId: lb }) : Promise.resolve(undefined),
    lb ? prisma.ward.findMany({ where: { localBodyId: lb }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true, isActive: true, lgdCode: true } }) : Promise.resolve([]),
  ]);
  const total = (k: "mandals" | "gramPanchayats" | "urbanBodies" | "wards" | "villages") => districts.reduce((sum, d) => sum + d[k], 0).toLocaleString("en-IN");
  return (
    <div className="space-y-4">
      <Card variant="admin" title="Local Government Directory data" bodyClassName="overflow-x-auto p-0">
        <div className="space-y-1 p-4 text-sm">
          <p>Geography comes from the official <strong>Local Government Directory</strong> (lgdirectory.gov.in). To refresh it, download the latest exports, run <code>npm run lgd:convert</code> and <code>npm run lgd:import</code> (see docs/LGD_DATA.md). Records are matched by LGD code; nothing is deleted.</p>
          {report && <p className="text-ink-500">Last conversion: {fmtDateTime(report.generatedAt)}. {Object.entries(report.issues).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`).join("; ") || "No data-quality issues."}</p>}
        </div>
        <table className="table min-w-[760px] text-[13px]">
          <thead><tr><th scope="col">District</th><th scope="col">LGD code</th><th scope="col">Mandals</th><th scope="col">Gram Panchayats</th><th scope="col">Urban bodies</th><th scope="col">Wards</th><th scope="col">Villages</th><th scope="col">Map marker</th></tr></thead>
          <tbody>{districts.map((d) => <tr key={d.id}><td className="font-medium text-ink-900">{d.name}</td><td>{d.lgdCode ?? "—"}</td><td>{d.mandals}</td><td>{d.gramPanchayats.toLocaleString("en-IN")}</td><td>{d.urbanBodies}</td><td>{d.wards.toLocaleString("en-IN")}</td><td>{d.villages.toLocaleString("en-IN")}</td><td>{d.latitude != null ? `${d.latitude.toFixed(2)}, ${d.longitude?.toFixed(2)}` : "missing"}</td></tr>)}
            <tr className="font-semibold"><td>Total</td><td /><td>{total("mandals")}</td><td>{total("gramPanchayats")}</td><td>{total("urbanBodies")}</td><td>{total("wards")}</td><td>{total("villages")}</td><td /></tr></tbody>
        </table>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card variant="admin" title="Activate or deactivate wards">
          <form method="get" className="mb-3" aria-label="Choose a Panchayat or Municipality">
            <input type="hidden" name="tab" value="geography" />
            <GeoPicker defaultValue={lbPath} names={{ localBody: "lb" }} depth="localBody" autoSubmit idPrefix="gw" className="grid gap-3 sm:grid-cols-3" />
          </form>
          {!lb ? <p className="text-sm text-ink-500">Choose a Panchayat or Municipality to manage its wards.</p> : (
            <ul className="flex flex-wrap gap-2">{lbWards.map((w) => (
              <li key={w.id}><ActionButton action={`/api/admin/geo/wards/${w.id}`} method="PATCH" body={{ isActive: !w.isActive }} className={`rounded-full border px-3 py-1 text-xs ${w.isActive ? "border-line" : "border-alert-500 text-alert-600 line-through"}`} successMessage={w.isActive ? "Ward deactivated." : "Ward reactivated."}
                confirm={w.isActive ? { title: `Deactivate Ward ${w.number}?`, message: "It disappears from selectors and dashboards. Its complaints and history are kept. A later LGD import reactivates wards that LGD still lists.", confirmLabel: "Deactivate", danger: true } : undefined}>Ward {w.number}{w.lgdCode ? ` (LGD ${w.lgdCode})` : ""}</ActionButton></li>
            ))}</ul>
          )}
        </Card>
        <Card variant="admin" title="Add a district, local body or ward">
          <p className="mb-3 text-xs text-ink-500">Prefer LGD imports for official units; use this for pilots or units LGD has not published yet.</p>
          <ApiForm action="/api/admin/geo" successMessage="Added." resetOnSuccess className="space-y-3">
            <GeoParentPicker />
            <div><label className="label" htmlFor="g-name">Name</label><input id="g-name" name="name" className="input" required /><FieldError name="name" /></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="g-num">Ward number</label><input id="g-num" name="number" type="number" min="1" className="input" /></div><div><label className="label" htmlFor="g-code">District code</label><input id="g-code" name="code" className="input" /></div></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="g-lat">Latitude</label><input id="g-lat" name="latitude" type="number" step="0.000001" className="input" /></div><div><label className="label" htmlFor="g-lng">Longitude</label><input id="g-lng" name="longitude" type="number" step="0.000001" className="input" /></div></div>
            <p className="hint">Coordinates are a centre point for map markers, not a boundary.</p>
            <SubmitButton>Add</SubmitButton>
          </ApiForm>
        </Card>
      </div>
    </div>
  );
}

async function CategoriesTab() {
  const { categories, departments } = await listOrg();
  const fields = (c?: (typeof categories)[number]) => (
    <>
      <div><label className="label" htmlFor={`cn-${c?.id ?? "new"}`}>Name</label><input id={`cn-${c?.id ?? "new"}`} name="name" className="input" defaultValue={c?.name} required /></div>
      <div><label className="label" htmlFor={`cs-${c?.id ?? "new"}`}>Slug</label><input id={`cs-${c?.id ?? "new"}`} name="slug" className="input" defaultValue={c?.slug} required pattern="[a-z0-9-]{2,30}" /></div>
      <div><label className="label" htmlFor={`ci-${c?.id ?? "new"}`}>Icon key</label><input id={`ci-${c?.id ?? "new"}`} name="icon" className="input" defaultValue={c?.icon ?? "other"} required /></div>
      <div><label className="label" htmlFor={`cc-${c?.id ?? "new"}`}>Colour</label><input id={`cc-${c?.id ?? "new"}`} name="color" type="color" className="h-10 w-16 rounded border border-line" defaultValue={c?.color ?? "#8a96ad"} /></div>
      <div><label className="label" htmlFor={`ch-${c?.id ?? "new"}`}>SLA (hours)</label><input id={`ch-${c?.id ?? "new"}`} name="slaHours" type="number" min="1" className="input" defaultValue={c?.slaHours ?? 72} /></div>
      <div><label className="label" htmlFor={`cd-${c?.id ?? "new"}`}>Default department</label><select id={`cd-${c?.id ?? "new"}`} name="departmentId" className="select" defaultValue={c?.departmentId ?? ""}><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} />Active</label>
    </>
  );
  return (
    <div className="space-y-4">
      {categories.map((c) => (
        <Card key={c.id} variant="admin" title={`${c.name}: ${c._count.complaints} complaints`}>
          <ApiForm action={`/api/admin/categories/${c.id}`} method="PUT" booleans={["isActive"]} successMessage="Category saved." className="grid items-end gap-3 md:grid-cols-4 xl:grid-cols-8">{fields(c)}<SubmitButton className="btn-outline">Save</SubmitButton></ApiForm>
        </Card>
      ))}
      <Card variant="admin" title="New category"><ApiForm action="/api/admin/categories" booleans={["isActive"]} successMessage="Category created." resetOnSuccess className="grid items-end gap-3 md:grid-cols-4 xl:grid-cols-8">{fields()}<SubmitButton>Create</SubmitButton></ApiForm></Card>
    </div>
  );
}

async function ScoringTab() {
  const [indicators, minCoverage] = await Promise.all([prisma.indicatorDefinition.findMany({ orderBy: { sortOrder: "asc" } }), getMinCoverage()]);
  return (
    <Card variant="admin" title="Development score configuration">
      <p className="mb-4 text-sm text-ink-700">Score = Σ(normalised value × weight) ÷ Σ(weights with data). Values are normalised linearly between “worst” (0 points) and “target” (100 points). See docs/SCORING.md.</p>
      <ScoringForm indicators={indicators.map((i) => ({ id: i.id, name: i.name, unit: i.unit, weight: i.weight, target: i.target, worst: i.worst, isActive: i.isActive }))} minCoverage={minCoverage} />
    </Card>
  );
}

async function ContentTab() {
  const c = await getSiteContent();
  const f = (k: keyof typeof c, label: string, long = false, required = true) => (
    <div className={long ? "md:col-span-2" : ""}><label className="label" htmlFor={`sc-${k}`}>{label}</label>{long ? <textarea id={`sc-${k}`} name={k} className="input min-h-[90px]" defaultValue={c[k]} required={required} /> : <input id={`sc-${k}`} name={k} className="input" defaultValue={c[k]} required={required} />}<FieldError name={k} /></div>
  );
  return (
    <Card variant="admin" title="Public site content">
      <ApiForm action="/api/admin/content" method="PUT" successMessage="Site content saved." className="grid gap-3 md:grid-cols-2">
        {f("subtitle", "Header subtitle")}{f("heroTitle", "Hero heading")}{f("taglineOne", "Tagline, line 1")}{f("taglineTwo", "Tagline, line 2")}
        {f("heroText", "Hero text", true)}{f("footerSlogan", "Footer slogan")}{f("contactEmail", "Contact email")}{f("website", "Website")}{f("location", "Location line / head office")}
        {f("founderName", "Founder name (leave empty to hide)", false, false)}{f("founderTitle", "Founder title")}{f("founderBio", "Founder profile (About page)", true)}
        <div className="md:col-span-2"><SubmitButton>Save content</SubmitButton></div>
      </ApiForm>
    </Card>
  );
}
