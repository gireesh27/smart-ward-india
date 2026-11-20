"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, MapPin, Search } from "@/components/app-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { LOCAL_BODY_TYPE_LABEL, type GeoPath } from "@/lib/geo-types";

type DistrictOpt = { id: string; name: string; latitude: number | null; longitude: number | null };
type LbOpt = { id: string; name: string; type: string; subDistrict: string | null };
type WardOpt = { id: string; number: number; name: string };
type SearchHit = { kind: "village" | "localBody"; id: string; label: string; sublabel: string; path: GeoPath };

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return (await r.json()).data as T;
}

const VARIANT = {
  default: "select",
  compact: "select py-1.5 text-[13px]",
  pill: "cursor-pointer appearance-none rounded-full border border-white/25 bg-[#0b2a5e]/80 py-2 pl-4 pr-8 text-[14px] font-medium text-white outline-none backdrop-blur hover:bg-[#123673] focus-visible:ring-2 focus-visible:ring-saffron-500 disabled:opacity-50",
} as const;

/**
 * Cascading location picker: State → District → Panchayat/Municipality (searchable) → Ward.
 * Loads each level on demand from /api/geo/*. Emits hidden inputs for the names given,
 * so it works inside API forms and plain GET filter forms (autoSubmit).
 */
export function GeoPicker({
  value, defaultValue, onChange, names = {}, depth = "ward", required = false, scoped = false, autoSubmit = false,
  variant = "default", showLabels = true, villageSearch = false, idPrefix = "geo", className,
}: {
  value?: GeoPath; defaultValue?: GeoPath; onChange?: (p: GeoPath) => void;
  names?: { state?: string; district?: string; localBody?: string; ward?: string };
  depth?: "district" | "localBody" | "ward"; required?: boolean; scoped?: boolean; autoSubmit?: boolean;
  variant?: keyof typeof VARIANT; showLabels?: boolean; villageSearch?: boolean; idPrefix?: string; className?: string;
}) {
  const [inner, setInner] = useState<GeoPath>(value ?? defaultValue ?? {});
  const path = value ?? inner;
  const [states, setStates] = useState<Array<{ id: string; name: string }>>([]);
  const [districts, setDistricts] = useState<DistrictOpt[]>([]);
  const [wards, setWards] = useState<WardOpt[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const anchor = useRef<HTMLInputElement>(null);
  const submitNext = useRef(false);
  const sc = scoped ? "&scoped=1" : "";

  useEffect(() => { if (value) setInner(value); }, [value]);
  const set = (next: GeoPath) => { setInner(next); onChange?.(next); submitNext.current = autoSubmit; };
  useEffect(() => { if (submitNext.current) { submitNext.current = false; anchor.current?.form?.requestSubmit(); } }, [inner]);

  useEffect(() => {
    getJson<Array<{ id: string; name: string }>>("/api/geo").then((s) => {
      setStates(s);
      if (!path.state && s.length === 1) { const next = { state: s[0] }; setInner(next); onChange?.(next); }
    }).catch(() => setStates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!path.state?.id) { setDistricts([]); return; }
    getJson<DistrictOpt[]>(`/api/geo/districts?state=${path.state.id}${sc}`).then(setDistricts).catch(() => setDistricts([]));
  }, [path.state?.id, sc]);
  useEffect(() => {
    if (depth !== "ward" || !path.localBody?.id) { setWards([]); return; }
    setLoadingWards(true);
    getJson<WardOpt[]>(`/api/geo/wards?localBody=${path.localBody.id}${sc}`).then(setWards).catch(() => setWards([])).finally(() => setLoadingWards(false));
  }, [path.localBody?.id, depth, sc]);

  const cls = VARIANT[variant];
  const lab = (text: string, id: string) => <label className={showLabels ? "label" : "sr-only"} htmlFor={id}>{text}</label>;
  const field = (child: React.ReactNode) => (variant === "pill" ? <div className="relative">{child}</div> : <div className="min-w-0">{child}</div>);

  return (
    <div className={cn(variant === "pill" ? "flex flex-wrap gap-2.5" : variant === "compact" ? "space-y-1.5" : "grid gap-3 sm:grid-cols-2", className)}>
      <input ref={anchor} type="hidden" />
      {names.state && <input type="hidden" name={names.state} value={path.state?.id ?? ""} />}
      {names.district && <input type="hidden" name={names.district} value={path.district?.id ?? ""} />}
      {names.localBody && <input type="hidden" name={names.localBody} value={path.localBody?.id ?? ""} />}
      {names.ward && <input type="hidden" name={names.ward} value={path.ward?.id ?? ""} />}

      {villageSearch && variant !== "pill" && <div className="sm:col-span-2"><VillageSearch idPrefix={idPrefix} onPick={(p) => set(p)} /></div>}

      {field(<>
        {lab("State", `${idPrefix}-state`)}
        <select id={`${idPrefix}-state`} className={cls} value={path.state?.id ?? ""} required={required}
          onChange={(e) => { const s = states.find((x) => x.id === e.target.value); set(s ? { state: s } : {}); }}>
          <option value="">{variant === "pill" ? "All states" : "Select state"}</option>
          {path.state && !states.some((s) => s.id === path.state!.id) && <option value={path.state.id}>{path.state.name}</option>}
          {states.map((s) => <option key={s.id} value={s.id} className="text-ink-900">{s.name}</option>)}
        </select>
      </>)}
      {field(<>
        {lab("District", `${idPrefix}-district`)}
        <select id={`${idPrefix}-district`} className={cls} value={path.district?.id ?? ""} required={required && depth !== "district" ? true : required} disabled={!path.state}
          onChange={(e) => { const d = districts.find((x) => x.id === e.target.value); set({ state: path.state, district: d ?? null }); }}>
          <option value="">{variant === "pill" ? "All districts" : "Select district"}</option>
          {path.district && !districts.some((d) => d.id === path.district!.id) && <option value={path.district.id}>{path.district.name}</option>}
          {districts.map((d) => <option key={d.id} value={d.id} className="text-ink-900">{d.name}</option>)}
        </select>
      </>)}
      {depth !== "district" && field(<>
        {lab("Panchayat / Municipality", `${idPrefix}-local`)}
        <LocalBodyCombobox id={`${idPrefix}-local`} districtId={path.district?.id} value={path.localBody ?? null} scoped={scoped} variant={variant}
          onSelect={(lb) => set({ state: path.state, district: path.district, localBody: lb })} />
      </>)}
      {depth === "ward" && field(<>
        {lab("Ward", `${idPrefix}-ward`)}
        <select id={`${idPrefix}-ward`} className={cls} value={path.ward?.id ?? ""} required={required} disabled={!path.localBody}
          onChange={(e) => { const w = wards.find((x) => x.id === e.target.value); set({ ...path, ward: w ?? null }); }}>
          <option value="">{loadingWards ? "Loading wards…" : variant === "pill" ? "All wards" : "Select ward"}</option>
          {path.ward && !wards.some((w) => w.id === path.ward!.id) && <option value={path.ward.id}>Ward No. {path.ward.number}</option>}
          {wards.map((w) => <option key={w.id} value={w.id} className="text-ink-900">Ward No. {w.number}{w.name && !/ward/i.test(w.name) ? ` — ${w.name}` : ""}</option>)}
        </select>
      </>)}
    </div>
  );
}

const lbCache = new Map<string, { total: number; items: LbOpt[] }>();

/** All Panchayats and municipalities of the district (up to ~920), searchable instantly, scrollable. */
function LocalBodyCombobox({ id, districtId, value, onSelect, scoped, variant }: { id: string; districtId?: string; value: LbOpt | null; onSelect: (lb: LbOpt | null) => void; scoped: boolean; variant: keyof typeof VARIANT }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [items, setItems] = useState<LbOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !districtId) return;
    const key = `${districtId}:${scoped ? 1 : 0}`;
    const hit = lbCache.get(key);
    if (hit) { setItems(hit.items); return; }
    let cancelled = false;
    setLoading(true); setError(false);
    getJson<{ total: number; items: LbOpt[] }>(`/api/geo/local-bodies?district=${districtId}&limit=2000${scoped ? "&scoped=1" : ""}`)
      .then((d) => { if (cancelled) return; lbCache.set(key, d); setItems(d.items); })
      .catch(() => { if (!cancelled) { setItems([]); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, districtId, scoped]);

  const urban = items.filter((i) => i.type !== "GRAM_PANCHAYAT");
  const rural = items.filter((i) => i.type === "GRAM_PANCHAYAT");
  const item = (i: LbOpt) => (
    <CommandItem key={i.id} value={`${i.name} ${i.subDistrict ?? ""} ${LOCAL_BODY_TYPE_LABEL[i.type] ?? ""} ${i.id}`} onSelect={() => { onSelect(i); setOpen(false); }}>
      <Check className={cn("h-4 w-4 shrink-0", value?.id === i.id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{i.name}</span>
      <span className="shrink-0 text-[11px] opacity-70">{i.type === "GRAM_PANCHAYAT" ? (i.subDistrict ? `${i.subDistrict} mandal` : "Gram Panchayat") : LOCAL_BODY_TYPE_LABEL[i.type]}</span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" disabled={!districtId}
          className={cn(VARIANT[variant], "flex w-full items-center justify-between gap-2 text-left", variant === "pill" && "min-w-[13rem] pr-3")}>
          <span className={cn("truncate", !value && "opacity-70")}>{value ? value.name : variant === "pill" ? "All Panchayats / Municipalities" : "Search Panchayat / Municipality"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0">
        <Command loop>
          <CommandInput placeholder="Type a Panchayat, municipality or mandal…" />
          {!loading && items.length > 0 && <p className="border-b border-line px-3 py-1.5 text-[11px] text-ink-500">{rural.length.toLocaleString("en-IN")} Gram Panchayats and {urban.length} urban local bodies. Scroll or type to filter.</p>}
          <CommandList id={listId} className="max-h-[min(60vh,22rem)] overscroll-contain">
            {loading && <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading all Panchayats and municipalities…</p>}
            {error && <p className="px-3 py-4 text-sm text-alert-600">Could not load the list. Check your connection and reopen.</p>}
            <CommandEmpty>No match in this district.</CommandEmpty>
            {value && variant === "pill" && <CommandGroup><CommandItem value="__all all panchayats municipalities" onSelect={() => { onSelect(null); setOpen(false); }}>All Panchayats / Municipalities</CommandItem></CommandGroup>}
            {urban.length > 0 && <CommandGroup heading={`Urban local bodies (${urban.length})`}>{urban.map(item)}</CommandGroup>}
            {rural.length > 0 && <CommandGroup heading={`Gram Panchayats (${rural.length.toLocaleString("en-IN")})`}>{rural.map(item)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Residents often know their village, not their Panchayat: search LGD villages and jump to the right GP. */
function VillageSearch({ idPrefix, onPick }: { idPrefix: string; onPick: (p: GeoPath) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => getJson<SearchHit[]>(`/api/geo/search?q=${encodeURIComponent(q.trim())}`).then((h) => { setHits(h); setOpen(true); }).catch(() => setHits([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <label className="label" htmlFor={`${idPrefix}-village`}>Find by village or town <span className="font-normal text-ink-500">(optional)</span></label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input id={`${idPrefix}-village`} className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="e.g. Kuchipudi, Ghantasala" autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${idPrefix}-village-list`} />
      </div>
      {open && hits.length > 0 && (
        <ul id={`${idPrefix}-village-list`} role="listbox" className="glass-strong absolute z-[60] mt-1 max-h-72 w-full overflow-y-auto rounded-xl p-1">
          {hits.map((h) => (
            <li key={`${h.kind}-${h.id}`} role="option" aria-selected="false">
              <button type="button" className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(h.path); setQ(h.label); setOpen(false); }}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span><span className="block font-medium text-ink-900">{h.label}</span><span className="block text-xs text-ink-500">{h.sublabel}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
