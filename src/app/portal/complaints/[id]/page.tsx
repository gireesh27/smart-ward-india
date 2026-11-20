import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { getComplaintForActor } from "@/lib/services/complaints";
import { AppError } from "@/lib/errors";
import { REOPEN_WINDOW_DAYS } from "@/lib/domain/status";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Card, StatusBadge } from "@/components/ui";
import { Gallery, Timeline } from "@/components/complaints/Timeline";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { FileUploader } from "@/components/client/FileUploader";
import { ActionButton } from "@/components/client/ActionButton";

export default async function ComplaintDetail({ params, searchParams }: { params: { id: string }; searchParams: { submitted?: string } }) {
  const actor = await requireActor(`/portal/complaints/${params.id}`);
  const res = await getComplaintForActor({ ...actor, isAdmin: false }, params.id).catch((e) => { if (e instanceof AppError && e.status === 404) notFound(); throw e; });
  const c = res.complaint;
  const reviewed = c.feedback.some((f) => c.resolvedAt && new Date(f.createdAt) >= new Date(c.resolvedAt));
  const canReopen = c.status === "RESOLVED" || (c.status === "CLOSED" && c.closedAt && Date.now() - new Date(c.closedAt).getTime() < REOPEN_WINDOW_DAYS * 86_400_000);
  const reported = c.attachments.filter((a) => a.purpose === "COMPLAINT");
  const evidence = c.attachments.filter((a) => a.purpose === "RESOLUTION");
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/portal/complaints" className="link text-sm">← My complaints</Link>
      {searchParams.submitted && <p role="status" className="mt-3 rounded-md bg-leaf-100 px-4 py-3 text-sm font-medium text-leaf-700">Thank you — your complaint was submitted. Keep your reference <strong>{c.reference}</strong> to follow it up.</p>}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-ink-500">{c.category.name}, reference {c.reference}</p><h1 className="text-2xl font-bold text-navy-700">{c.title}</h1></div>
        <StatusBadge status={c.status} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card title="Your report">
            <p className="whitespace-pre-line text-sm">{c.description}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-500">Location</dt><dd>{c.address}{c.landmark ? ` (near ${c.landmark})` : ""}</dd></div>
              <div><dt className="text-ink-500">Ward</dt><dd>Ward {c.ward.number}, {c.ward.localBody.name}</dd></div>
              <div><dt className="text-ink-500">Submitted</dt><dd>{fmtDateTime(c.createdAt)}</dd></div>
              <div><dt className="text-ink-500">Target date</dt><dd>{fmtDate(c.dueAt)}</dd></div>
              {c.department && <div><dt className="text-ink-500">Handled by</dt><dd>{c.department.name}</dd></div>}
              {c.duplicateOf && <div><dt className="text-ink-500">Duplicate of</dt><dd>{c.duplicateOf.reference}</dd></div>}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{c.isPublic ? <>Visible to residents of your ward. <strong>{c.supportCount}</strong> {c.supportCount === 1 ? "neighbour supports" : "neighbours support"} this</> : "Private — only you and the ward office can see this report."}</span>
              <ActionButton action={`/api/complaints/${c.id}/visibility`} method="PATCH" body={{ isPublic: !c.isPublic }} successMessage={c.isPublic ? "Report is now private." : "Neighbours can now see and support this report."} className="btn-outline btn-sm">{c.isPublic ? "Make private" : "Let neighbours support it"}</ActionButton>
            </div>
            <div className="mt-4"><Gallery files={reported} title="Your photos and videos" /></div>
          </Card>
          {c.resolutionNote && (
            <Card title="Resolution">
              <p className="whitespace-pre-line text-sm">{c.resolutionNote}</p>
              <p className="mt-1 text-xs text-ink-500">Resolved {fmtDateTime(c.resolvedAt)}</p>
              <div className="mt-3"><Gallery files={evidence} title="Evidence from the ward office" /></div>
            </Card>
          )}
          {c.status === "RESOLVED" && !reviewed && (
            <Card title="Is the problem fixed?" id="review">
              <ApiForm action={`/api/complaints/${c.id}/feedback`} booleans={[]} successMessage="Thank you for your feedback." className="space-y-3">
                <fieldset><legend className="label">Rate the resolution</legend>
                  <div className="flex gap-3">{[1, 2, 3, 4, 5].map((r) => <label key={r} className="flex items-center gap-1 text-sm"><input type="radio" name="rating" value={r} required defaultChecked={r === 4} />{r}</label>)}</div>
                </fieldset>
                <fieldset><legend className="label">Is it fixed?</legend>
                  <label className="mr-4 text-sm"><input type="radio" name="satisfied" value="true" defaultChecked className="mr-1" />Yes, close it</label>
                  <label className="text-sm"><input type="radio" name="satisfied" value="false" className="mr-1" />No, it is not fixed</label>
                </fieldset>
                <div><label className="label" htmlFor="fb-comment">Comment <span className="font-normal text-ink-500">(optional)</span></label><textarea id="fb-comment" name="comment" className="input" maxLength={1000} /></div>
                <SubmitButton>Send feedback</SubmitButton>
              </ApiForm>
            </Card>
          )}
          {canReopen && (
            <Card title="Still a problem?">
              <p className="mb-3 text-sm">If the issue is not fixed, ask the ward office to reopen it. Requests can be made within {REOPEN_WINDOW_DAYS} days of closing.</p>
              <ApiForm action={`/api/complaints/${c.id}/reopen`} successMessage="Reopen request sent." className="space-y-3">
                <label className="label" htmlFor="reopen-reason">What is still wrong?</label>
                <textarea id="reopen-reason" name="reason" className="input" required minLength={10} maxLength={1000} />
                <FieldError name="reason" />
                <SubmitButton className="btn-orange">Request reopening</SubmitButton>
              </ApiForm>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Progress"><Timeline history={c.history} comments={c.comments} showInternal={false} /></Card>
          {!["REJECTED", "DUPLICATE"].includes(c.status) && (
            <Card title="Add an update">
              <ApiForm action={`/api/complaints/${c.id}/comments`} successMessage="Update added." resetOnSuccess className="space-y-3">
                <label className="sr-only" htmlFor="comment-body">Message</label>
                <textarea id="comment-body" name="body" className="input min-h-[90px]" placeholder="Add details or a follow-up for the ward office" required maxLength={2000} />
                <FieldError name="body" />
                <FileUploader purpose="COMMENT" label="Attach photos or videos" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" />
                <SubmitButton>Send update</SubmitButton>
              </ApiForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
