import { CheckCircle2, Lock, MessageSquare, Paperclip } from "@/components/app-icons";
import { STATUS_LABELS, type Status } from "@/lib/domain/status";
import { fmtDateTime } from "@/lib/format";

type Hist = { id: string; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: Date; actor: { name: string } | null };
type Com = { id: string; body: string; visibility: string; createdAt: Date; author: { name: string }; attachments: Array<{ id: string; fileName: string; mimeType: string }> };

/** Status changes and messages merged into one chronological timeline. */
export function Timeline({ history, comments, showInternal }: { history: Hist[]; comments: Com[]; showInternal: boolean }) {
  const items = [
    ...history.map((h) => ({ kind: "status" as const, at: new Date(h.createdAt), h })),
    ...comments.filter((c) => showInternal || c.visibility === "PUBLIC").map((c) => ({ kind: "comment" as const, at: new Date(c.createdAt), c })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
      {items.map((it) => it.kind === "status" ? (
        <li key={`h${it.h.id}`} className="relative">
          <CheckCircle2 className="absolute -left-[31px] top-0.5 h-5 w-5 rounded-full bg-surface text-brand-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink-900">{it.h.fromStatus ? `${STATUS_LABELS[it.h.fromStatus as Status]} → ${STATUS_LABELS[it.h.toStatus as Status]}` : "Submitted"}</p>
          <p className="text-xs text-ink-500">{fmtDateTime(it.h.createdAt)}{it.h.actor ? `, by ${it.h.actor.name}` : ""}</p>
          {it.h.reason && <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{it.h.reason}</p>}
        </li>
      ) : (
        <li key={`c${it.c.id}`} className="relative">
          {it.c.visibility === "INTERNAL"
            ? <Lock className="absolute -left-[31px] top-0.5 h-5 w-5 rounded-full bg-surface p-0.5 text-saffron-600" aria-hidden="true" />
            : <MessageSquare className="absolute -left-[31px] top-0.5 h-5 w-5 rounded-full bg-surface p-0.5 text-leaf-700" aria-hidden="true" />}
          <div className={`rounded-md px-3 py-2 ${it.c.visibility === "INTERNAL" ? "border border-saffron-500/40 bg-saffron-100" : "bg-brand-50"}`}>
            <p className="text-xs text-ink-500"><span className="font-semibold text-ink-900">{it.c.author.name}</span>, {fmtDateTime(it.c.createdAt)}{it.c.visibility === "INTERNAL" && <span className="ml-2 badge bg-saffron-500 text-white">Internal note</span>}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{it.c.body}</p>
            {it.c.attachments.length > 0 && <ul className="mt-1 flex flex-wrap gap-2">{it.c.attachments.map((a) => <li key={a.id}><a className="link inline-flex items-center gap-1 text-xs" href={`/api/files/${a.id}`} target="_blank" rel="noopener"><Paperclip className="h-3 w-3" aria-hidden="true" />{a.fileName}</a></li>)}</ul>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Gallery({ files, title }: { files: Array<{ id: string; fileName: string; mimeType: string }>; title: string }) {
  if (files.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-900">{title}</h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {files.map((f) => (
          <li key={f.id}>
            {f.mimeType.startsWith("video/") ? (
              <video src={`/api/files/${f.id}`} controls playsInline preload="metadata" className="aspect-[4/3] w-full rounded-md border border-line bg-black object-contain" aria-label={f.fileName} />
            ) : (
              <a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-md border border-line">
                {f.mimeType.startsWith("image/") ? <img src={`/api/files/${f.id}`} alt={f.fileName} className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <span className="flex aspect-[4/3] items-center justify-center bg-muted p-2 text-center text-xs">{f.fileName}</span>}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
