"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, LocateFixed, X } from "@/components/app-icons";
import { SupportButton } from "./SupportButton";
import { AP_CENTER, type GeoPath } from "@/lib/geo-types";
import { CategoryIcon, TILE_STYLE } from "@/components/icons";
import { GeoPicker } from "./GeoPicker";
import { LocationPicker, type LatLng } from "./LocationPicker";
import { clearDraft, loadDraft, saveDraft, type DraftFields } from "./draft";
import { useToast } from "./Toast";

type Cat = { id: string; slug: string; name: string };
type Photo = { key: string; file: File; url: string; attachmentId?: string };
type Errors = Partial<Record<string, string>>;

const SEVERITY = [
  { v: "LOW", label: "Low", hint: "Inconvenient, not urgent" },
  { v: "MEDIUM", label: "Medium", hint: "Affects daily life" },
  { v: "HIGH", label: "High", hint: "Affects many people" },
  { v: "CRITICAL", label: "Critical", hint: "Safety or health risk" },
];

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];

export function ReportForm({ categories, authenticated, defaultPath, maxFiles = 6, maxBytes = 5 * 1024 * 1024, maxVideoBytes = 50 * 1024 * 1024 }: {
  categories: Cat[]; authenticated: boolean; defaultPath?: GeoPath; maxFiles?: number; maxBytes?: number; maxVideoBytes?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [geo, setGeo] = useState<GeoPath>(defaultPath ?? {});
  const [categoryId, setCategoryId] = useState("");
  const [f, setF] = useState({ title: "", description: "", address: "", landmark: "", severity: "MEDIUM" });
  const [pin, setPin] = useState<LatLng>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const idemKey = useRef<string>("");
  const ready = useRef(false);

  // Restore an unsent draft (from the landing widget, a sign-in round trip, or a refresh).
  useEffect(() => {
    idemKey.current = crypto.randomUUID();
    loadDraft().then((d) => {
      if (d) {
        const x = d.fields;
        if (x.geo?.state) setGeo(x.geo);
        if (x.categoryId) setCategoryId(x.categoryId);
        if (typeof x.isPublic === "boolean") setIsPublic(x.isPublic);
        setF((cur) => ({ title: x.title ?? cur.title, description: x.description ?? cur.description, address: x.address ?? cur.address, landmark: x.landmark ?? cur.landmark, severity: x.severity ?? cur.severity }));
        if (x.latitude != null && x.longitude != null) setPin({ lat: x.latitude, lng: x.longitude });
        if (d.files.length) setPhotos(d.files.map((p, i) => { const file = new File([p.blob], p.name, { type: p.type }); return { key: `d${i}`, file, url: URL.createObjectURL(file) }; }));
        if (x.title || x.description || d.files.length) setRestoredAt(d.savedAt);
      }
      ready.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fields = (): DraftFields => ({ geo, wardId: geo.ward?.id, categoryId, ...f, latitude: pin?.lat, longitude: pin?.lng, isPublic });

  // Autosave text fields while typing (photos are saved when a sign-in is needed).
  useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(async () => {
      const cur = await loadDraft();
      await saveDraft({ fields: fields(), files: cur?.files ?? [] });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, categoryId, f, pin, isPublic]);

  // LGD wards carry no coordinates; centre the pin map on the district headquarters instead.
  const center = useMemo(() => (geo.district?.latitude != null && geo.district.longitude != null ? { lat: geo.district.latitude, lng: geo.district.longitude } : AP_CENTER), [geo.district?.latitude, geo.district?.longitude]);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const next: Photo[] = [];
    for (const file of Array.from(list)) {
      if (photos.length + next.length >= maxFiles) { toast.error(`You can attach up to ${maxFiles} photos.`); break; }
      if (!MEDIA_TYPES.includes(file.type)) { toast.error(`${file.name}: use JPG, PNG, WEBP photos or MP4, WEBM, MOV videos.`); continue; }
      const limit = file.type.startsWith("video/") ? maxVideoBytes : maxBytes;
      if (file.size > limit) { toast.error(`${file.name} is larger than ${Math.round(limit / 1048576)} MB.`); continue; }
      next.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) });
    }
    setPhotos((p) => [...p, ...next]);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) { toast.error("This device does not support location."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPin({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); setLocating(false); },
      (err) => { setLocating(false); toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was declined. Tap the map instead." : "Could not get your location. Tap the map instead."); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!geo.ward?.id) e.wardId = "Choose your ward";
    if (!categoryId) e.categoryId = "Choose a category";
    if (f.title.trim().length < 5) e.title = "Use at least 5 characters";
    if (f.description.trim().length < 20) e.description = "Describe the problem in at least 20 characters";
    if (f.address.trim().length < 5) e.address = "Enter the street or area";
    return e;
  }

  async function goToSignIn() {
    await saveDraft({ fields: fields(), files: await Promise.all(photos.map(async (p) => ({ name: p.file.name, type: p.file.type, blob: p.file }))) });
    router.push(`/login?next=${encodeURIComponent("/portal/report")}&reason=report`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = validate();
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) { setFormError("Fix the highlighted fields."); return; }
    if (!authenticated) { await goToSignIn(); return; }

    // 1) upload photos not yet uploaded (ids are kept, so a retry never re-uploads)
    const ids: string[] = [];
    const updated = [...photos];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].attachmentId) { ids.push(updated[i].attachmentId!); continue; }
      setBusy(`Uploading ${updated[i].file.type.startsWith("video/") ? "video" : "photo"} ${i + 1} of ${updated.length}…`);
      const fd = new FormData();
      fd.append("file", updated[i].file);
      fd.append("purpose", "COMPLAINT");
      const res = await fetch("/api/uploads", { method: "POST", body: fd }).catch(() => null);
      if (res?.status === 401) { setBusy(null); await goToSignIn(); return; }
      const json = await res?.json().catch(() => ({}));
      if (!res?.ok) { setBusy(null); setPhotos(updated); setFormError(`${updated[i].file.name}: ${json?.error?.message ?? "upload failed"}. Remove it or try again.`); return; }
      updated[i] = { ...updated[i], attachmentId: json.data.id };
      ids.push(json.data.id);
    }
    setPhotos(updated);

    // 2) submit the complaint; the idempotency key makes double-submits harmless
    setBusy("Submitting your report…");
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wardId: geo.ward?.id, categoryId, ...f, landmark: f.landmark || undefined, latitude: pin?.lat, longitude: pin?.lng, attachmentIds: ids, isPublic, idempotencyKey: idemKey.current }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(null);
    if (res?.status === 401) { await goToSignIn(); return; }
    if (!res?.ok) {
      const fe = (json?.error?.details?.fieldErrors ?? {}) as Record<string, string[]>;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, msgs]) => [k, msgs[0]])));
      setFormError(json?.error?.message ?? "Could not submit. Check your connection and try again.");
      return;
    }
    await clearDraft();
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    router.push(`/portal/complaints/${json.data.id}?submitted=1`);
  }

  const err = (k: string) => errors[k] ? <p className="field-error" id={`${k}-error`}>{errors[k]}</p> : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {restoredAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm">
          <span>We restored your unsent report from {new Date(restoredAt).toLocaleString("en-IN")}.</span>
          <button type="button" className="btn-ghost btn-sm" onClick={async () => { await clearDraft(); location.reload(); }}>Discard draft</button>
        </div>
      )}
      {!authenticated && (
        <p className="rounded-md bg-saffron-100 px-4 py-3 text-sm text-ink-900">You can fill this in now. We keep it on this device while you sign in or create an account, then you can submit it.</p>
      )}

      <fieldset>
        <legend className="mb-2 font-display text-lg font-semibold text-ink-900">1. Where is the problem?</legend>
        <GeoPicker value={geo} onChange={setGeo} required villageSearch idPrefix="report" />
        {err("wardId")}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="address">Street or area</label>
            <input id="address" className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} aria-invalid={!!errors.address} aria-describedby={errors.address ? "address-error" : undefined} maxLength={300} />
            {err("address")}
          </div>
          <div>
            <label className="label" htmlFor="landmark">Landmark <span className="font-normal text-ink-500">(optional)</span></label>
            <input id="landmark" className="input" value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} maxLength={120} />
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Pin the exact spot <span className="font-normal text-ink-500">(optional — tap the map)</span></span>
            <div className="flex gap-2">
              <button type="button" className="btn-outline btn-sm" onClick={useMyLocation} disabled={locating}><LocateFixed className="h-4 w-4" aria-hidden="true" />{locating ? "Locating…" : "Use my location"}</button>
              {pin && <button type="button" className="btn-ghost btn-sm" onClick={() => setPin(null)}>Clear pin</button>}
            </div>
          </div>
          <LocationPicker value={pin} center={center} onChange={setPin} />
          <p className="hint">{pin ? `Pinned at ${pin.lat}, ${pin.lng}. Only the ward office can see the exact location.` : "Your device location is only used if you tap “Use my location”."}</p>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-lg font-semibold text-ink-900">2. What kind of problem?</legend>
        <div role="radiogroup" aria-label="Category" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map((c) => {
            const st = TILE_STYLE[c.slug] ?? TILE_STYLE.other;
            const on = categoryId === c.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 text-sm font-medium text-ink-900 ${st.bg} ${on ? "border-brand-600 ring-2 ring-brand-100" : "border-transparent"}`}>
                <CategoryIcon name={c.slug} className="h-6 w-6" color={st.fg} />{c.name}
              </button>
            );
          })}
        </div>
        {err("categoryId")}
        {geo.ward?.id && categoryId && <SimilarIssues wardId={geo.ward.id} categoryId={categoryId} signedIn={authenticated} />}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-lg font-semibold text-ink-900">3. Describe it</legend>
        <div>
          <label className="label" htmlFor="title">Short title</label>
          <input id="title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} placeholder="e.g. No water supply for three days" aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
          {err("title")}
        </div>
        <div>
          <label className="label" htmlFor="description">Details</label>
          <textarea id="description" className="input min-h-[120px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} placeholder="What is happening, since when, and who is affected?" aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : "description-hint"} />
          <p className="hint" id="description-hint">{f.description.length}/2000</p>
          {err("description")}
        </div>
        <div role="radiogroup" aria-label="How serious is it?">
          <span className="label">How serious is it?</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITY.map((s) => (
              <button key={s.v} type="button" role="radio" aria-checked={f.severity === s.v} onClick={() => setF({ ...f, severity: s.v })}
                className={`rounded-md border px-3 py-2 text-left text-sm ${f.severity === s.v ? "border-brand-600 bg-brand-50" : "border-line bg-surface"}`}>
                <span className="block font-semibold text-ink-900">{s.label}</span><span className="text-xs text-ink-500">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-lg font-semibold text-ink-900">4. Add photos or videos <span className="text-sm font-normal text-ink-500">(up to {maxFiles}; photos {Math.round(maxBytes / 1048576)} MB, videos {Math.round(maxVideoBytes / 1048576)} MB each)</span></legend>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.key} className="relative h-24 w-24 overflow-hidden rounded-md border border-line">
              {p.file.type.startsWith("video/") ? <video src={p.url} muted playsInline preload="metadata" className="h-full w-full bg-black object-cover" aria-label={`Selected video ${p.file.name}`} /> : <img src={p.url} alt={`Selected photo ${p.file.name}`} className="h-full w-full object-cover" />}
              <button type="button" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((xs) => xs.filter((x) => x.key !== p.key)); }} className="absolute right-1 top-1 rounded-full bg-surface/90 p-1" aria-label={`Remove ${p.file.name}`}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {photos.length < maxFiles && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-brand-400 text-xs font-medium text-brand-600 hover:bg-brand-50">
              <Camera className="h-6 w-6" aria-hidden="true" />Add photo / video
              <input type="file" accept={MEDIA_TYPES.join(",")} multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-md border border-line bg-muted px-4 py-3 text-sm">
        <input type="checkbox" className="mt-1" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span><strong className="text-ink-900">Let neighbours see and support this report.</strong> Only the title, category and status are shown to other residents of the ward. Your name, address, description, location and photos stay private.</span>
      </label>

      {formError && <p role="alert" className="rounded-md bg-alert-100 px-3 py-2 text-sm font-medium text-alert-600">{formError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-navy px-6 py-3 text-base" disabled={!!busy} aria-busy={!!busy}>
          <Camera className="h-5 w-5" aria-hidden="true" />{busy ?? (authenticated ? "Upload photos & submit" : "Continue to sign in")}
        </button>
        {geo.ward && geo.localBody && <span className="text-sm text-ink-500">Reporting to Ward {geo.ward.number}, {geo.localBody.name}</span>}
      </div>
    </form>
  );
}

type PublicIssue = { id: string; reference: string; title: string; status: string; createdAt: string; supportCount: number; mine: boolean; supportedByMe: boolean };

/** Shows open public reports of the same kind in the ward, so residents can support one instead of filing a duplicate. */
function SimilarIssues({ wardId, categoryId, signedIn }: { wardId: string; categoryId: string; signedIn: boolean }) {
  const [items, setItems] = useState<PublicIssue[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    fetch(`/api/public/issues?ward=${encodeURIComponent(wardId)}&category=${encodeURIComponent(categoryId)}&limit=5`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setItems(j.data ?? []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [wardId, categoryId]);
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-saffron-500/40 bg-saffron-100 p-3" role="region" aria-label="Similar open reports in this ward">
      <p className="text-sm font-semibold text-ink-900">Already reported nearby? Support it instead of filing a duplicate.</p>
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 text-ink-900">{i.title} <span className="text-xs text-ink-500">({i.reference})</span></span>
            {i.mine ? <span className="badge bg-surface text-ink-700">Your report</span> : <SupportButton complaintId={i.id} count={i.supportCount} supported={i.supportedByMe} signedIn={signedIn} compact />}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-500">Different problem? Carry on with the form below.</p>
    </div>
  );
}
