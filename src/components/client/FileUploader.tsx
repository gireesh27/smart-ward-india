"use client";
import { useId, useState } from "react";
import { Paperclip, X } from "@/components/app-icons";

type Item = { key: string; name: string; status: "uploading" | "done" | "error"; id?: string; error?: string };

/** Uploads immediately to /api/uploads and exposes resulting ids as hidden inputs for the surrounding form. */
export function FileUploader({ purpose, name = "attachmentIds[]", max = 6, accept = "image/jpeg,image/png,image/webp", label = "Attach files" }: { purpose: string; name?: string; max?: number; accept?: string; label?: string }) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);

  async function upload(files: FileList | null) {
    if (!files) return;
    const room = max - items.length;
    for (const file of Array.from(files).slice(0, room)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setItems((xs) => [...xs, { key, name: file.name, status: "uploading" }]);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        setItems((xs) => xs.map((x) => (x.key === key ? (res.ok ? { ...x, status: "done", id: json.data.id } : { ...x, status: "error", error: json?.error?.message ?? "Upload failed" }) : x)));
      } catch {
        setItems((xs) => xs.map((x) => (x.key === key ? { ...x, status: "error", error: "Network error" } : x)));
      }
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="btn-outline btn-sm cursor-pointer"><Paperclip className="h-4 w-4" aria-hidden="true" />{label}</label>
      <input id={inputId} type="file" className="sr-only" accept={accept} multiple disabled={items.length >= max} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2">
              <span className={it.status === "error" ? "text-alert-600" : it.status === "done" ? "text-leaf-700" : "text-ink-500"}>
                {it.name} — {it.status === "uploading" ? "uploading…" : it.status === "done" ? "ready" : it.error}
              </span>
              <button type="button" className="rounded p-0.5 text-ink-500 hover:bg-muted" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} aria-label={`Remove ${it.name}`}><X className="h-3.5 w-3.5" /></button>
              {it.id && <input type="hidden" name={name} value={it.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
