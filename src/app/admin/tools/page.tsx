import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { listOrg } from "@/lib/services/org";
import { listMeetings, openFollowUps } from "@/lib/services/meetings";
import { listAnnouncements } from "@/lib/services/content";
import { districtScopeWhere } from "@/lib/authz";
import { GeoPicker } from "@/components/client/GeoPicker";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, EmptyState } from "@/components/ui";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { ActionButton } from "@/components/client/ActionButton";

export const metadata = { title: "Government tools" };
const TABS = [["departments", "Departments & staff"], ["meetings", "Review meetings"], ["announcements", "Announcements"], ["followups", "Follow-ups"]] as const;

export default async function Tools({ searchParams }: { searchParams: { tab?: string } }) {
  const actor = await requireAdminPage("/admin/tools");
  const tab = TABS.some(([t]) => t === searchParams.tab) ? searchParams.tab! : "departments";
  const canManageDepts = actor.role !== "WARD_ADMIN";
  return (
    <>
      <AdminTopBar actor={actor} title="Government Tools" subtitle="Departments, staff, review meetings and announcements" />
      <nav aria-label="Tools sections" className="mb-4 flex flex-wrap gap-2">{TABS.map(([t, l]) => <Link key={t} href={`?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={tab === t ? "btn-primary btn-sm" : "btn-sm btn bg-white/10 text-white hover:bg-white/20"}>{l}</Link>)}</nav>
      {tab === "departments" && <Departments canManage={canManageDepts} />}
      {tab === "meetings" && <Meetings actorId={actor.id} actor={actor} />}
      {tab === "announcements" && <Announcements actor={actor} />}
      {tab === "followups" && <FollowUps actor={actor} />}
    </>
  );
}

async function Departments({ canManage }: { canManage: boolean }) {
  const { departments, staff } = await listOrg();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card variant="admin" title="Departments" bodyClassName="overflow-x-auto p-0">
        <table className="table"><thead><tr><th scope="col">Name</th><th scope="col">Code</th><th scope="col">Staff</th><th scope="col">Complaints</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{departments.map((d) => <tr key={d.id} className={d.isActive ? "" : "opacity-60"}><td>{d.name}</td><td>{d.code}</td><td>{d._count.staff}</td><td>{d._count.complaints}</td><td>{canManage && <ActionButton action={`/api/admin/departments/${d.id}`} method="PATCH" body={{ isActive: !d.isActive }} successMessage="Saved." confirm={d.isActive ? { title: `Deactivate ${d.name}?`, message: "It will no longer be offered for new assignments. Existing complaints keep their history.", confirmLabel: "Deactivate", danger: true } : undefined}>{d.isActive ? "Deactivate" : "Activate"}</ActionButton>}</td></tr>)}</tbody></table>
        {canManage && (
          <ApiForm action="/api/admin/departments" successMessage="Department added." resetOnSuccess className="grid gap-2 border-t border-line p-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <div><label className="label" htmlFor="d-name">Department name</label><input id="d-name" name="name" className="input" required /><FieldError name="name" /></div>
            <div><label className="label" htmlFor="d-code">Code</label><input id="d-code" name="code" className="input" required placeholder="WATER" /><FieldError name="code" /></div>
            <SubmitButton>Add</SubmitButton>
          </ApiForm>
        )}
      </Card>
      <Card variant="admin" title="Field staff" bodyClassName="overflow-x-auto p-0">
        <table className="table"><thead><tr><th scope="col">Name</th><th scope="col">Department</th><th scope="col">Open load</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{staff.map((s) => <tr key={s.id} className={s.isActive ? "" : "opacity-60"}><td>{s.name}<span className="block text-xs text-ink-500">{s.designation}</span></td><td>{s.department.name}</td><td>{s._count.complaints}</td><td><ActionButton action={`/api/admin/staff/${s.id}`} method="PATCH" body={{ isActive: !s.isActive }} successMessage="Saved.">{s.isActive ? "Deactivate" : "Activate"}</ActionButton></td></tr>)}</tbody></table>
        <ApiForm action="/api/admin/staff" successMessage="Staff member added." resetOnSuccess className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="s-name">Name</label><input id="s-name" name="name" className="input" required /></div>
          <div><label className="label" htmlFor="s-des">Designation</label><input id="s-des" name="designation" className="input" required /></div>
          <div><label className="label" htmlFor="s-dept">Department</label><select id="s-dept" name="departmentId" className="select" required>{departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label" htmlFor="s-phone">Phone</label><input id="s-phone" name="phone" className="input" /></div>
          <SubmitButton className="btn-primary sm:col-span-2">Add staff member</SubmitButton>
        </ApiForm>
      </Card>
    </div>
  );
}

async function Meetings({ actor }: { actorId: string; actor: Parameters<typeof listMeetings>[0] }) {
  const [meetings, districts] = await Promise.all([listMeetings(actor), prisma.district.findMany({ where: districtScopeWhere(actor), orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
      <Card variant="admin" title="Meetings">
        {meetings.length === 0 ? <EmptyState title="No meetings yet">Schedule a review meeting to track agendas and action items.</EmptyState> : (
          <ul className="divide-y divide-line">{meetings.map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 py-3"><div className="flex-1"><Link className="link" href={`/admin/tools/meetings/${m.id}`}>{m.title}</Link><p className="text-xs text-ink-500">{fmtDateTime(m.scheduledAt)}, {m.location}, {m.ward ? `Ward ${m.ward.number}, ${m.ward.localBody.name}` : m.district?.name ?? "All areas"}</p></div><span className="badge bg-brand-50 text-brand-700">{m.status.toLowerCase()}</span><span className="text-xs">{m.actionItems.length} open action{m.actionItems.length === 1 ? "" : "s"}</span></li>)}</ul>
        )}
      </Card>
      <Card variant="admin" title="Schedule a review meeting" id="new-meeting">
        <ApiForm action="/api/admin/meetings" successMessage="Meeting scheduled." redirectTo="/admin/tools/meetings/{id}" className="space-y-3">
          <div><label className="label" htmlFor="mt-title">Title</label><input id="mt-title" name="title" className="input" required defaultValue="Monthly ward review" /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="mt-at">Date & time</label><input id="mt-at" name="scheduledAt" type="datetime-local" className="input" required /><FieldError name="scheduledAt" /></div><div><label className="label" htmlFor="mt-dur">Minutes</label><input id="mt-dur" name="durationMins" type="number" min="15" max="480" defaultValue="60" className="input" /></div></div>
          <div><label className="label" htmlFor="mt-loc">Location</label><input id="mt-loc" name="location" className="input" required placeholder="Collectorate conference hall" /></div>
          <div><label className="label" htmlFor="mt-d">District <span className="font-normal text-ink-500">(district-wide meeting)</span></label><select id="mt-d" name="districtId" className="select"><option value="">—</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <fieldset><legend className="label">Or a specific ward</legend><GeoPicker names={{ ward: "wardId" }} scoped variant="compact" idPrefix="mt" /></fieldset>
          <div><label className="label" htmlFor="mt-ag">Agenda</label><textarea id="mt-ag" name="agenda" className="input min-h-[90px]" required minLength={10} defaultValue={"1. Overdue complaints\n2. Water supply alerts\n3. Project milestones"} /></div>
          <div><label className="label" htmlFor="mt-p">Participants</label><textarea id="mt-p" name="participants" className="input" placeholder={"One per line: Name <email>, role"} /><p className="hint">Administrators with matching emails are notified.</p></div>
          <SubmitButton className="btn-orange">Schedule meeting</SubmitButton>
        </ApiForm>
      </Card>
    </div>
  );
}

async function Announcements({ actor }: { actor: Parameters<typeof listAnnouncements>[0] }) {
  const [items, districts] = await Promise.all([listAnnouncements(actor), prisma.district.findMany({ where: districtScopeWhere(actor), orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card variant="admin" title="Announcements">
        {items.length === 0 ? <EmptyState title="No announcements yet" /> : (
          <ul className="divide-y divide-line">{items.map((a) => <li key={a.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-semibold">{a.title}</p><span className={`badge ${a.isPublished ? "bg-leaf-100 text-leaf-700" : "bg-muted text-ink-500"}`}>{a.isPublished ? "Published" : "Draft"}</span><ActionButton action={`/api/admin/announcements/${a.id}`} method="PATCH" body={{ isPublished: !a.isPublished }} successMessage="Saved.">{a.isPublished ? "Unpublish" : "Publish"}</ActionButton></div><p className="text-sm">{a.body}</p><p className="text-xs text-ink-500">{a.ward ? `Ward ${a.ward.number}, ${a.ward.localBody.name}` : a.district ? a.district.name : "Platform-wide"}, {fmtDate(a.publishedAt ?? a.createdAt)}</p></li>)}</ul>
        )}
      </Card>
      <Card variant="admin" title="New announcement">
        <ApiForm action="/api/admin/announcements" booleans={["isPublished"]} successMessage="Announcement saved." resetOnSuccess className="space-y-3">
          <div><label className="label" htmlFor="an-t">Title</label><input id="an-t" name="title" className="input" required /></div>
          <div><label className="label" htmlFor="an-b">Message</label><textarea id="an-b" name="body" className="input min-h-[90px]" required /></div>
          <fieldset><legend className="label">Ward</legend><GeoPicker names={{ ward: "wardId" }} scoped variant="compact" idPrefix="an" /></fieldset>
          {actor.role !== "WARD_ADMIN" && <div><label className="label" htmlFor="an-d">Or whole district</label><select id="an-d" name="districtId" className="select"><option value="">—</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" />Publish now (notifies residents of the ward)</label>
          <SubmitButton>Save announcement</SubmitButton>
        </ApiForm>
      </Card>
    </div>
  );
}

async function FollowUps({ actor }: { actor: Parameters<typeof openFollowUps>[0] }) {
  const items = await openFollowUps(actor);
  return (
    <Card variant="admin" title="Open action items from meetings">
      {items.length === 0 ? <EmptyState title="No open follow-ups" /> : (
        <table className="table"><thead><tr><th scope="col">Action</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Meeting</th></tr></thead>
          <tbody>{items.map((a) => <tr key={a.id}><td>{a.description}</td><td>{a.ownerName}</td><td className={a.dueDate && a.dueDate < new Date() ? "font-semibold text-alert-600" : ""}>{fmtDate(a.dueDate)}</td><td><Link className="link" href={`/admin/tools/meetings/${a.meeting.id}`}>{a.meeting.title}</Link></td></tr>)}</tbody></table>
      )}
    </Card>
  );
}
