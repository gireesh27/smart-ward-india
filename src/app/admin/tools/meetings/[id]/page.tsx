import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/session";
import { getMeeting } from "@/lib/services/meetings";
import { AppError } from "@/lib/errors";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card } from "@/components/ui";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { ActionButton } from "@/components/client/ActionButton";

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const actor = await requireAdminPage(`/admin/tools/meetings/${params.id}`);
  const m = await getMeeting(actor, params.id).catch((e) => { if (e instanceof AppError && e.status === 404) notFound(); throw e; });
  return (
    <>
      <AdminTopBar actor={actor} title={m.title} subtitle={`${fmtDateTime(m.scheduledAt)}, ${m.location} (${m.status.toLowerCase()})`} />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card variant="admin" title="Agenda"><p className="whitespace-pre-line text-sm">{m.agenda}</p></Card>
          <Card variant="admin" title="Action items">
            <ul className="space-y-2">{m.actionItems.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm">
                <span className="flex-1">{a.description} <span className="block text-xs text-ink-500">{a.ownerName}, due {fmtDate(a.dueDate)}</span></span>
                <span className="badge bg-brand-50 text-brand-700">{a.status.replace("_", " ").toLowerCase()}</span>
                {a.status !== "DONE" && <ActionButton action={`/api/admin/meetings/${m.id}/action-items`} method="PATCH" body={{ itemId: a.id, status: "DONE" }} successMessage="Marked done.">Mark done</ActionButton>}
                {a.status === "OPEN" && <ActionButton action={`/api/admin/meetings/${m.id}/action-items`} method="PATCH" body={{ itemId: a.id, status: "IN_PROGRESS" }} successMessage="Updated.">Start</ActionButton>}
              </li>
            ))}</ul>
            <ApiForm action={`/api/admin/meetings/${m.id}/action-items`} successMessage="Action item added." resetOnSuccess className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <div><label className="label" htmlFor="ai-d">Action</label><input id="ai-d" name="description" className="input" required /><FieldError name="description" /></div>
              <div><label className="label" htmlFor="ai-o">Owner</label><input id="ai-o" name="ownerName" className="input" required /></div>
              <div><label className="label" htmlFor="ai-due">Due</label><input id="ai-due" name="dueDate" type="date" className="input" /></div>
              <SubmitButton>Add</SubmitButton>
            </ApiForm>
          </Card>
        </div>
        <div className="space-y-4">
          <Card variant="admin" title="Participants"><ul className="space-y-1 text-sm">{m.participants.map((p) => <li key={p.id}>{p.name}{p.role ? <span className="text-ink-500"> — {p.role}</span> : null}</li>)}</ul></Card>
          <Card variant="admin" title="Outcome">
            <ApiForm action={`/api/admin/meetings/${m.id}`} method="PATCH" successMessage="Meeting updated." className="space-y-3">
              <div><label className="label" htmlFor="mm-s">Status</label><select id="mm-s" name="status" className="select" defaultValue={m.status}><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></div>
              <div><label className="label" htmlFor="mm-min">Minutes</label><textarea id="mm-min" name="minutes" className="input min-h-[140px]" defaultValue={m.minutes ?? ""} /></div>
              <SubmitButton>Save</SubmitButton>
            </ApiForm>
          </Card>
        </div>
      </div>
    </>
  );
}
