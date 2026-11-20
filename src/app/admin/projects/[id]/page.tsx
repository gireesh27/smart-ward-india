import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { getProject } from "@/lib/services/projects";
import { geoPathFor } from "@/lib/services/geo";
import { AppError } from "@/lib/errors";
import { fmtDate, fmtDateTime, fmtINR } from "@/lib/format";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card, ProgressBar } from "@/components/ui";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { ActionButton } from "@/components/client/ActionButton";
import { FileUploader } from "@/components/client/FileUploader";

export default async function AdminProject({ params }: { params: { id: string } }) {
  const actor = await requireAdminPage(`/admin/projects/${params.id}`);
  const p = await getProject(actor, params.id).catch((e) => { if (e instanceof AppError && e.status === 404) notFound(); throw e; });
  if (!p.canEdit) notFound();
  const [path, categories, departments] = await Promise.all([geoPathFor({ wardId: p.wardId }), prisma.category.findMany({ orderBy: { sortOrder: "asc" } }), prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })]);
  return (
    <>
      <AdminTopBar actor={actor} title={p.name} subtitle={`${p.code}, Ward ${p.ward.number}, ${p.ward.localBody.name}${p.archivedAt ? " (archived)" : ""}`} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card variant="admin" title="Overview">
            <div className="grid gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-ink-500">Progress</p><p className="font-display text-3xl font-bold text-navy-700">{p.progress}%</p><ProgressBar value={p.progress} label="Progress" /></div>
              <div><p className="text-xs text-ink-500">Budget</p><p className="font-semibold">{fmtINR(p.budget)}</p></div>
              <div><p className="text-xs text-ink-500">Spent</p><p className="font-semibold">{fmtINR(p.expenditure)}</p></div>
              <div><p className="text-xs text-ink-500">Target</p><p className="font-semibold">{fmtDate(p.targetDate)}</p></div>
            </div>
            <p className="mt-3 text-xs text-ink-500">Progress mode: {p.progressMode === "MILESTONES" ? "calculated from weighted milestones" : "manual updates (each is audited)"}.</p>
          </Card>
          <Card variant="admin" title="Edit project"><ProjectForm project={{ id: p.id, name: p.name, description: p.description, categoryId: p.categoryId, wardId: p.wardId, departmentId: p.departmentId, budget: p.budget.toString(), expenditure: p.expenditure.toString(), startDate: p.startDate, targetDate: p.targetDate, status: p.status, progressMode: p.progressMode, isPublic: p.isPublic }} path={path} categories={categories} departments={departments} /></Card>
          <Card variant="admin" title="Files">
            {p.attachments.length > 0 && <ul className="mb-3 space-y-1 text-sm">{p.attachments.map((a) => <li key={a.id}><a className="link" href={`/api/files/${a.id}`} target="_blank" rel="noopener">{a.fileName}</a> <span className="text-xs text-ink-500">({a.purpose === "PROJECT_PHOTO" ? "photo" : "document"}, {a.isPublic ? "public" : "internal"})</span></li>)}</ul>}
            <ApiForm action={`/api/projects/${p.id}/files`} successMessage="Files attached." booleans={["isPublic"]} resetOnSuccess className="space-y-3">
              <div className="flex flex-wrap gap-3"><FileUploader purpose="PROJECT_PHOTO" label="Upload photos" /><FileUploader purpose="PROJECT_DOCUMENT" label="Upload documents" accept="application/pdf,image/jpeg,image/png" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" />Visible on the public project page</label>
              <SubmitButton className="btn-outline">Attach uploaded files</SubmitButton>
            </ApiForm>
          </Card>
        </div>
        <div className="space-y-4">
          <Card variant="admin" title="Milestones">
            <ol className="space-y-2">
              {p.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <ActionButton action={`/api/projects/${p.id}/milestones`} method="PATCH" body={{ milestoneId: m.id, completed: !m.completedAt }} className={`h-5 w-5 rounded border ${m.completedAt ? "border-leaf-600 bg-leaf-600" : "border-ink-300 bg-surface"}`} successMessage={m.completedAt ? "Milestone reopened." : "Milestone completed."}><span className="sr-only">{m.completedAt ? `Mark ${m.title} as not done` : `Mark ${m.title} as done`}</span></ActionButton>
                  <span className={`flex-1 ${m.completedAt ? "line-through text-ink-500" : ""}`}>{m.title} <span className="text-xs text-ink-500">(weight {m.weight})</span></span>
                  <span className="text-xs text-ink-500">{m.completedAt ? fmtDate(m.completedAt) : m.dueDate ? `due ${fmtDate(m.dueDate)}` : ""}</span>
                </li>
              ))}
            </ol>
            <ApiForm action={`/api/projects/${p.id}/milestones`} successMessage="Milestone added." resetOnSuccess className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-line pt-3">
              <div className="col-span-2"><label className="label" htmlFor="m-title">New milestone</label><input id="m-title" name="title" className="input" required minLength={3} /><FieldError name="title" /></div>
              <div><label className="label" htmlFor="m-due">Due</label><input id="m-due" name="dueDate" type="date" className="input" /></div>
              <div><label className="label" htmlFor="m-w">Weight</label><input id="m-w" name="weight" type="number" min="1" max="10" defaultValue="1" className="input w-20" /></div>
              <SubmitButton className="btn-outline col-span-2">Add milestone</SubmitButton>
            </ApiForm>
          </Card>
          {p.progressMode === "MANUAL" && (
            <Card variant="admin" title="Record progress">
              <ApiForm action={`/api/projects/${p.id}/progress`} successMessage="Progress recorded." resetOnSuccess className="space-y-2">
                <label className="label" htmlFor="mp">Progress (%)</label><input id="mp" name="progress" type="number" min="0" max="100" className="input" defaultValue={p.progress} required />
                <label className="label" htmlFor="mn">What changed?</label><input id="mn" name="note" className="input" required minLength={5} /><FieldError name="note" />
                <SubmitButton>Save progress</SubmitButton>
              </ApiForm>
            </Card>
          )}
          <Card variant="admin" title="Progress history">
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">{p.progressLogs.map((l) => <li key={l.id} className="border-b border-line pb-1"><strong>{l.progress}%</strong>: {l.note} <span className="block text-xs text-ink-500">{fmtDateTime(l.createdAt)}, {l.actor.name} ({l.source.toLowerCase()})</span></li>)}</ul>
          </Card>
          <Card variant="admin" title={p.archivedAt ? "Restore project" : "Archive project"}>
            <p className="mb-3 text-sm">{p.archivedAt ? "Restoring makes the project visible again." : "Archived projects are hidden from dashboards but keep their full history."}</p>
            <ActionButton action={`/api/projects/${p.id}/archive`} body={{ archived: !p.archivedAt }} successMessage={p.archivedAt ? "Project restored." : "Project archived."} className={p.archivedAt ? "btn-outline" : "btn-danger"} confirm={{ title: p.archivedAt ? "Restore this project?" : "Archive this project?", message: p.archivedAt ? "It will appear on dashboards again." : "It will disappear from dashboards and the public site. You can restore it later.", confirmLabel: p.archivedAt ? "Restore" : "Archive", danger: !p.archivedAt }}>{p.archivedAt ? "Restore" : "Archive project"}</ActionButton>
          </Card>
        </div>
      </div>
    </>
  );
}
