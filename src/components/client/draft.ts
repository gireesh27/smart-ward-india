"use client";
// Unsent complaint drafts live in IndexedDB so text *and* photos survive a
// sign-in round trip (or a refresh). Nothing leaves the device until submit.

import type { GeoPath } from "@/lib/geo-types";

export type DraftFields = {
  geo?: GeoPath; wardId?: string; categoryId?: string;
  title?: string; description?: string; address?: string; landmark?: string; severity?: string; latitude?: number; longitude?: number; isPublic?: boolean;
};
export type Draft = { fields: DraftFields; files: Array<{ name: string; type: string; blob: Blob }>; savedAt: number };

const DB = "smartward", STORE = "drafts", KEY = "complaint";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function loadDraft(): Promise<Draft | null> {
  try { return ((await tx("readonly", (s) => s.get(KEY))) as Draft | undefined) ?? null; } catch { return null; }
}
export async function saveDraft(d: Omit<Draft, "savedAt">) {
  try { await tx("readwrite", (s) => s.put({ ...d, savedAt: Date.now() }, KEY)); } catch { /* storage unavailable: degrade silently */ }
}
export async function mergeDraftFields(fields: DraftFields) {
  const cur = await loadDraft();
  await saveDraft({ fields: { ...(cur?.fields ?? {}), ...fields }, files: cur?.files ?? [] });
}
export async function clearDraft() {
  try { await tx("readwrite", (s) => s.delete(KEY)); } catch { /* ignore */ }
}
