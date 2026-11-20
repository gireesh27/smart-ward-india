import { notFound } from "next/navigation";
import { getActor } from "@/lib/session";
import { getProject } from "@/lib/services/projects";
import { AppError } from "@/lib/errors";
import { fmtDate, fmtINR } from "@/lib/format";
import { Card, ProgressBar } from "@/components/ui";

export default async function PublicProjectPage({ params }: { params: { id: string } }) {
  const actor = await getActor();
  const p = await getProject(actor?.isAdmin ? actor : null, params.id).catch((e) => { if (e instanceof AppError && e.status === 404) notFound(); throw e; });
  const photos = p.attachments.filter((a) => a.mimeType.startsWith("image/"));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-ink-500">{p.category.name} project, reference {p.code}</p>
      <h1 className="text-3xl font-bold text-navy-700">{p.name}</h1>
      <p className="mt-1 text-sm text-ink-700">Ward {p.ward.number}, {p.ward.localBody.name}, {p.ward.localBody.district.name} district{p.department ? `. Delivered by ${p.department.name}` : ""}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_280px]">
        <Card title="About this project"><p className="whitespace-pre-line text-sm leading-relaxed">{p.description}</p></Card>
        <Card title="Progress">
          <p className="font-display text-3xl font-bold text-navy-700">{p.progress}%</p>
          <ProgressBar value={p.progress} label="Project progress" className="mt-2" />
          <dl className="mt-4 space-y-1 text-sm"><div className="flex justify-between"><dt>Status</dt><dd className="font-medium">{p.status.charAt(0) + p.status.slice(1).toLowerCase().replace(/_/g, " ")}</dd></div><div className="flex justify-between"><dt>Budget</dt><dd>{fmtINR(p.budget)}</dd></div><div className="flex justify-between"><dt>Spent</dt><dd>{fmtINR(p.expenditure)}</dd></div><div className="flex justify-between"><dt>Start</dt><dd>{fmtDate(p.startDate)}</dd></div><div className="flex justify-between"><dt>Target</dt><dd>{fmtDate(p.targetDate)}</dd></div></dl>
        </Card>
      </div>
      <Card title="Milestones" className="mt-4">
        {p.milestones.length === 0 ? <p className="text-sm text-ink-500">No milestones published.</p> : (
          <ol className="space-y-2 text-sm">{p.milestones.map((m) => <li key={m.id} className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${m.completedAt ? "bg-leaf-500" : "bg-track"}`} aria-hidden="true" /><span className="flex-1">{m.title}</span><span className="text-ink-500">{m.completedAt ? `Done ${fmtDate(m.completedAt)}` : m.dueDate ? `Due ${fmtDate(m.dueDate)}` : "Planned"}</span></li>)}</ol>
        )}
      </Card>
      {photos.length > 0 && <Card title="Photos" className="mt-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((a) => <img key={a.id} src={`/api/files/${a.id}`} alt={a.fileName} className="aspect-video w-full rounded-md object-cover" />)}</div></Card>}
    </div>
  );
}
