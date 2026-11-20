"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "@/components/app-icons";
import type { GeoPath } from "@/lib/geo-types";
import { GeoPicker } from "@/components/client/GeoPicker";

/** Ward Analytics: build a comparison of up to four wards from the cascading picker. */
export function WardCompare({ selected, range }: { selected: Array<{ id: string; label: string }>; range: number }) {
  const router = useRouter();
  const [path, setPath] = useState<GeoPath>({});
  const ids = selected.map((s) => s.id);
  const go = (next: string[]) => router.push(`/admin/analytics?${new URLSearchParams({ ...(next.length ? { wards: next.join(",") } : {}), range: String(range) })}`);
  const canAdd = !!path.ward && ids.length < 4 && !ids.includes(path.ward.id);
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label="Wards being compared">
        {selected.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-ink-900">
            {s.label}
            <button type="button" onClick={() => go(ids.filter((i) => i !== s.id))} className="rounded-full p-1 hover:bg-brand-100" aria-label={`Remove ${s.label}`}><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
        {selected.length === 0 && <li className="text-sm text-ink-500">No wards selected yet.</li>}
      </ul>
      <div className="grid items-end gap-3 lg:grid-cols-[1fr_auto]">
        <GeoPicker value={path} onChange={setPath} scoped idPrefix="cmp" className="grid gap-3 sm:grid-cols-4" />
        <button type="button" className="btn-primary" disabled={!canAdd} onClick={() => path.ward && go([...ids, path.ward.id])}><Plus className="h-4 w-4" aria-hidden="true" />Add to comparison</button>
      </div>
      {ids.length >= 4 && <p className="hint">Up to four wards can be compared at once.</p>}
    </div>
  );
}

/** Settings → Users: one geographic assignment for a new administrator. */
export function ScopePicker({ allowDistrict }: { allowDistrict: boolean }) {
  const [type, setType] = useState<"WARD" | "LOCAL_BODY" | "DISTRICT" | "STATE" | "NONE">("LOCAL_BODY");
  const [path, setPath] = useState<GeoPath>({});
  const id = type === "WARD" ? path.ward?.id : type === "LOCAL_BODY" ? path.localBody?.id : type === "DISTRICT" ? path.district?.id : type === "STATE" ? path.state?.id : undefined;
  return (
    <div className="space-y-3">
      <div><label className="label" htmlFor="nu-st">Scope level</label>
        <select id="nu-st" name="scopeType" className="select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="LOCAL_BODY">Whole Panchayat / Municipality</option>
          <option value="WARD">One ward</option>
          {allowDistrict && <><option value="DISTRICT">Whole district</option><option value="STATE">Whole state</option><option value="NONE">None (citizen or super admin)</option></>}
        </select></div>
      {type !== "NONE" && <GeoPicker value={path} onChange={setPath} scoped variant="compact" idPrefix="nu-scope" depth={type === "WARD" ? "ward" : type === "LOCAL_BODY" ? "localBody" : "district"} />}
      {id && <input type="hidden" name="scopeIds[]" value={id} />}
      {type !== "NONE" && !id && <p className="hint">Choose the {type === "WARD" ? "ward" : type === "LOCAL_BODY" ? "Panchayat or municipality" : type === "DISTRICT" ? "district" : "state"} this administrator will manage.</p>}
    </div>
  );
}

/** Settings → Geography: choose where a new district, local body or ward belongs. */
export function GeoParentPicker() {
  const [level, setLevel] = useState<"ward" | "localBody" | "district">("ward");
  const [path, setPath] = useState<GeoPath>({});
  const parentId = level === "ward" ? path.localBody?.id : level === "localBody" ? path.district?.id : path.state?.id;
  return (
    <div className="space-y-3">
      <div><label className="label" htmlFor="g-level">Add a</label>
        <select id="g-level" name="level" className="select" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
          <option value="ward">Ward (in a Panchayat / Municipality)</option><option value="localBody">Panchayat / Municipality (in a district)</option><option value="district">District (in a state)</option>
        </select></div>
      <GeoPicker value={path} onChange={setPath} variant="compact" idPrefix="g-parent" depth={level === "ward" ? "localBody" : "district"} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      {level === "localBody" && <div><label className="label" htmlFor="g-type">Type</label><select id="g-type" name="type" className="select"><option value="GRAM_PANCHAYAT">Gram Panchayat</option><option value="MUNICIPALITY">Municipality</option><option value="MUNICIPAL_CORPORATION">Municipal Corporation</option><option value="NAGAR_PANCHAYAT">Nagar Panchayat</option></select></div>}
    </div>
  );
}
