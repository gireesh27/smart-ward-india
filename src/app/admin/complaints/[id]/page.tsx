import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { getComplaintForActor } from "@/lib/services/complaints";
import { AppError } from "@/lib/errors";
import { allowedTransitions, isOverdue, STATUS_LABELS, type Status } from "@/lib/domain/status";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, PriorityBadge, StatusBadge } from "@/components/ui";
import { Gallery, Timeline } from "@/components/complaints/Timeline";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { FileUploader } from "@/components/client/FileUploader";
import { ActionButton } from "@/components/client/ActionButton";
import { WardMap } from "@/components/client/WardMap";

export default async function AdminComplaint({ params }: { params: { id: string } }) {
  const actor = await requireAdminPage(`/admin/complaints/${params.id}`);
  const res = await getComplaintForActor(actor, params.id).catch((e) => { if (e instanceof AppError && e.status === 404) notFound(); throw e; });
  if (res.view !== "admin") notFound();
  const c = res.complaint;
  const status = c.status as Status;
  const next = allowedTransitions(status, "ADMIN").filter((s) => s !== "ASSIGNED" && !(status === "REOPEN_REQUESTED"));
  const [departments, staff] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.staffMember.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, designation: true, department: { select: { name: true } } } }),
  ]);
  const late = isOverdue(status, c.dueAt);
  const canAssign = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(status);
  return (
    <>
      <AdminTopBar actor={actor} title={c.reference} subtitle={`${c.category.name}, Ward ${c.ward.number}, ${c.ward.localBody.name}`} />
      <Link href="/admin/complaints" className="mb-3 inline-block text-sm text-white hover:underline">← Back to queue</Link>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card variant="admin" title={c.title} action={<StatusBadge status={c.status} />}>
            <p className="whitespace-pre-line text-sm">{c.description}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-500">Reported by</dt><dd>{c.reporter.name}<span className="block text-xs text-ink-500">{c.reporter.email}{c.reporter.phone ? `, ${c.reporter.phone}` : ""}</span></dd></div>
              <div><dt className="text-ink-500">Address</dt><dd>{c.address}{c.landmark ? ` (near ${c.landmark})` : ""}</dd></div>
              <div><dt className="text-ink-500">Submitted</dt><dd>{fmtDateTime(c.createdAt)}</dd></div>
              <div><dt className="text-ink-500">Severity / priority</dt><dd className="flex gap-1">{c.severity} <PriorityBadge priority={c.priority} /></dd></div>
              <div><dt className="text-ink-500">Due (SLA {c.category.slaHours} h)</dt><dd className={late ? "font-semibold text-alert-600" : ""}>{fmtDateTime(c.dueAt)}{late ? " (overdue)" : ""}</dd></div>
              <div><dt className="text-ink-500">Assignment</dt><dd>{c.department?.name ?? "Unassigned"}{c.assignedStaff ? `, ${c.assignedStaff.name}` : ""}</dd></div>
              {c.duplicateOf && <div><dt className="text-ink-500">Duplicate of</dt><dd><Link className="link" href={`/admin/complaints/${c.duplicateOf.id}`}>{c.duplicateOf.reference}</Link></dd></div>}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{c.isPublic ? <>Public to ward residents. <strong>{c.supportCount}</strong> {c.supportCount === 1 ? "resident supports" : "residents support"} this report</> : "Private report (not shown to other residents)."}</span>
              <ActionButton action={`/api/complaints/${c.id}/visibility`} method="PATCH" body={{ isPublic: !c.isPublic }} successMessage="Visibility updated." className="btn-outline btn-sm" confirm={c.isPublic ? { title: "Hide from residents?", message: "Use this for titles that contain personal details or inappropriate content. The reporter can still see it.", confirmLabel: "Hide" } : undefined}>{c.isPublic ? "Hide from public" : "Make public"}</ActionButton>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Gallery files={c.attachments.filter((a) => a.purpose === "COMPLAINT")} title="Citizen photos and videos" />
              {c.latitude != null && c.longitude != null && <div><h3 className="mb-2 text-sm font-semibold">Reported location (private)</h3><WardMap points={[{ id: c.id, label: c.reference, lat: c.latitude, lng: c.longitude, score: null, band: "Needs Attention" }]} height={180} /></div>}
            </div>
          </Card>
          {c.resolutionNote && <Card variant="admin" title="Resolution"><p className="whitespace-pre-line text-sm">{c.resolutionNote}</p><div className="mt-3"><Gallery files={c.attachments.filter((a) => a.purpose === "RESOLUTION")} title="Evidence" /></div></Card>}
          {c.feedback.length > 0 && <Card variant="admin" title="Citizen feedback"><ul className="space-y-2 text-sm">{c.feedback.map((f) => <li key={f.id}><strong>{f.rating}/5</strong>, {f.satisfied ? "satisfied" : "not satisfied"}, {fmtDate(f.createdAt)}{f.comment ? <p className="text-ink-700">“{f.comment}”</p> : null}</li>)}</ul></Card>}
          <Card variant="admin" title="Timeline (internal notes highlighted)"><Timeline history={c.history} comments={c.comments} showInternal /></Card>
        </div>

        <div className="space-y-4">
          {status === "REOPEN_REQUESTED" && (
            <Card variant="admin" title="Review reopen request">
              <p className="mb-3 text-sm">{c.history.filter((h) => h.toStatus === "REOPEN_REQUESTED").at(-1)?.reason}</p>
              <ApiForm action={`/api/complaints/${c.id}/status`} successMessage="Complaint reopened." className="space-y-2">
                <input type="hidden" name="status" value="REOPENED" />
                <label className="label" htmlFor="ro-reason">Reason (shown to the citizen)</label><textarea id="ro-reason" name="reason" className="input" required minLength={5} />
                <SubmitButton className="btn-orange">Approve and reopen</SubmitButton>
              </ApiForm>
              <ApiForm action={`/api/complaints/${c.id}/status`} successMessage="Reopen request declined." className="mt-4 space-y-2 border-t border-line pt-4">
                <input type="hidden" name="status" value="CLOSED" />
                <label className="label" htmlFor="rd-reason">Why is no further work needed?</label><textarea id="rd-reason" name="reason" className="input" required minLength={5} />
                <SubmitButton className="btn-outline">Decline and keep closed</SubmitButton>
              </ApiForm>
            </Card>
          )}
          {canAssign && (
            <Card variant="admin" title="Assign">
              <ApiForm action={`/api/complaints/${c.id}/assign`} successMessage="Assignment saved." className="space-y-3">
                <div><label className="label" htmlFor="a-dept">Department</label><select id="a-dept" name="departmentId" className="select" defaultValue={c.departmentId ?? c.category.departmentId ?? ""} required><option value="">Choose…</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><FieldError name="departmentId" /></div>
                <div><label className="label" htmlFor="a-staff">Staff member <span className="font-normal text-ink-500">(optional)</span></label><select id="a-staff" name="staffId" className="select" defaultValue={c.assignedStaffId ?? ""}><option value="">Department queue</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.designation} ({s.department.name})</option>)}</select></div>
                <div><label className="label" htmlFor="a-note">Note</label><input id="a-note" name="note" className="input" maxLength={500} /></div>
                <SubmitButton>{status === "SUBMITTED" ? "Review & assign" : "Save assignment"}</SubmitButton>
              </ApiForm>
            </Card>
          )}
          {next.length > 0 && (
            <Card variant="admin" title="Change status">
              <ApiForm action={`/api/complaints/${c.id}/status`} successMessage="Status updated." className="space-y-3">
                <div><label className="label" htmlFor="s-status">New status</label><select id="s-status" name="status" className="select" required>{next.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></div>
                <div><label className="label" htmlFor="s-reason">Reason (visible to the citizen)</label><textarea id="s-reason" name="reason" className="input" maxLength={1000} /><p className="hint">Required for rejection, duplicates and moving backwards.</p><FieldError name="reason" /></div>
                {next.includes("RESOLVED") && (
                  <div className="rounded-md border border-line p-3">
                    <label className="label" htmlFor="s-res">Resolution note</label><textarea id="s-res" name="resolutionNote" className="input" maxLength={2000} placeholder="What was done to fix it?" />
                    <p className="hint mb-2">Required, with at least one evidence file, to mark resolved.</p>
                    <FileUploader purpose="RESOLUTION" name="evidenceIds[]" label="Upload evidence" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime" />
                  </div>
                )}
                {next.includes("DUPLICATE") && <div><label className="label" htmlFor="s-dup">Original complaint reference (for duplicates)</label><input id="s-dup" name="duplicateOfReference" className="input" placeholder="SWI-2611-XXXXXX" /></div>}
                <SubmitButton>Update status</SubmitButton>
              </ApiForm>
            </Card>
          )}
          <Card variant="admin" title="Priority">
            <ApiForm action={`/api/complaints/${c.id}/priority`} successMessage="Priority updated." className="flex flex-wrap items-end gap-2">
              <div><label className="label" htmlFor="p-pri">Priority</label><select id="p-pri" name="priority" className="select w-32" defaultValue={c.priority}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="min-w-[160px] flex-1"><label className="label" htmlFor="p-reason">Reason</label><input id="p-reason" name="reason" className="input" required minLength={5} /><FieldError name="reason" /></div>
              <SubmitButton className="btn-outline">Save</SubmitButton>
            </ApiForm>
          </Card>
          <Card variant="admin" title="Add note or reply">
            <ApiForm action={`/api/complaints/${c.id}/comments`} successMessage="Saved." resetOnSuccess className="space-y-3">
              <fieldset className="flex gap-4 text-sm"><legend className="sr-only">Visibility</legend>
                <label><input type="radio" name="visibility" value="PUBLIC" defaultChecked className="mr-1" />Reply to citizen</label>
                <label><input type="radio" name="visibility" value="INTERNAL" className="mr-1" />Internal note</label>
              </fieldset>
              <label className="sr-only" htmlFor="c-body">Message</label><textarea id="c-body" name="body" className="input min-h-[90px]" required maxLength={2000} /><FieldError name="body" />
              <FileUploader purpose="COMMENT" label="Attach photos or videos" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" />
              <SubmitButton>Save message</SubmitButton>
            </ApiForm>
          </Card>
        </div>
      </div>
    </>
  );
}
