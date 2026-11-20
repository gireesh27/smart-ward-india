"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type GeoJSON as LGeoJSON, type LatLngBoundsExpression, type Layer, type Map as LMap, type PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import { ChevronRight, Crosshair, Home, Loader2, Maximize2, Minimize2, Minus, Plus, Search, Tags, X } from "@/components/app-icons";
import { AP_BOUNDS } from "@/lib/geo-types";
import { cn } from "@/lib/utils";
import { AutoResize } from "./WardMapInner";
import type { AtlasLayer, AtlasMode, AtlasProps } from "./AtlasMap";

const FILES: Record<Exclude<AtlasLayer, "villages"> | "outline", string> = {
  districts: "/geo/andhra-pradesh-districts.geojson",
  mandals: "/geo/andhra-pradesh-mandals.geojson",
  constituencies: "/geo/andhra-pradesh-assembly-constituencies.geojson",
  outline: "/geo/andhra-pradesh.geojson",
};
const VILLAGE_INDEX = "/geo/villages/index.json";
const LAYER_LABEL: Record<AtlasLayer, string> = { districts: "Districts", constituencies: "Constituencies", mandals: "Mandals", villages: "Villages" };
const TILE = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";

type Stat = { score: number | null; band: string; wards: number; localBodies: number; reported: number; name: string; id: string };
type Stats = { asOf: string | null; areas: Record<string, Stat> };
type VillageIndex = { mandals: Record<string, number>; attribution?: string };
const cache = new Map<string, Promise<unknown>>();
function load<T>(url: string): Promise<T | null> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(url) as Promise<T | null>;
}
const loadStats = (layer: "districts" | "mandals", month?: string) =>
  load<{ data: Stats }>(`/api/geo/stats?layer=${layer}${month ? `&month=${month}` : ""}`).then((j) => j?.data ?? null);

const BAND_COLOR: Record<string, string> = { Excellent: "#12893b", Good: "#41c03b", "Needs Attention": "#fe9a22", Critical: "#de0d22" };
const bandOf = (s: number | null) => (s == null ? "No data" : s >= 90 ? "Excellent" : s >= 80 ? "Good" : s >= 70 ? "Needs Attention" : "Critical");
const BLUE = [["90 and above", "#0b3d91"], ["80 to 89", "#1557c0"], ["70 to 79", "#3f8cf0"], ["Below 70", "#9cc4f5"]] as const;
const blueOf = (s: number | null) => (s == null ? "#dbe6f5" : s >= 90 ? BLUE[0][1] : s >= 80 ? BLUE[1][1] : s >= 70 ? BLUE[2][1] : BLUE[3][1]);
const NO_DATA = "#cbd5e1";

type Agg = { score: number | null; band: string; wards: number; localBodies: number; reported: number };
function combine(stats: Array<Stat | undefined>): Agg | null {
  const s = stats.filter((x): x is Stat => !!x);
  if (!s.length) return null;
  const scored = s.filter((x) => x.score != null && x.wards > 0);
  const w = scored.reduce((a, x) => a + x.wards, 0);
  const score = w ? Math.round((scored.reduce((a, x) => a + (x.score as number) * x.wards, 0) / w) * 10) / 10 : null;
  return { score, band: bandOf(score), wards: s.reduce((a, x) => a + x.wards, 0), localBodies: s.reduce((a, x) => a + x.localBodies, 0), reported: s.reduce((a, x) => a + x.reported, 0) };
}

type Crumb = { key: string; name: string; bounds: L.LatLngBounds };
type Trail = { district?: Crumb; ac?: Crumb & { no: number }; mandal?: Crumb; village?: Crumb };
type Selected = { layer: AtlasLayer; key: string; title: string; subtitle: string; agg: Agg | null; districtId?: string; note?: string; mandalLgd?: string; bounds: L.LatLngBounds };

/** Zoom thresholds for the automatic drill-down. */
const layerForZoom = (z: number, villagesReady: boolean): AtlasLayer => (z <= 7 ? "districts" : z <= 9 ? "constituencies" : z <= 11 || !villagesReady ? "mandals" : "villages");

function Bridge({ onReady }: { onReady: (m: LMap) => void }) { const map = useMap(); useEffect(() => onReady(map), [map, onReady]); return null; }
function ZoomWatch({ onZoom }: { onZoom: (z: number) => void }) { const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) }); return null; }

/** Embedded maps never trap page scrolling: one finger scrolls the page, two fingers pan/zoom; Ctrl+wheel zooms. */
function GestureGuard({ active, hint }: { active: boolean; hint: (msg: string) => void }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!active) { map.dragging.enable(); map.scrollWheelZoom.enable(); return; }
    map.scrollWheelZoom.disable();
    if (coarse) map.dragging.disable();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); map.setZoom(map.getZoom() + (e.deltaY < 0 ? 1 : -1)); }
      else hint("Hold Ctrl (Cmd on Mac) and scroll to zoom, or use the + and - buttons");
    };
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) hint("Use two fingers to move and zoom the map"); };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("touchmove", onTouchMove); };
  }, [map, active, hint]);
  return null;
}

export default function AtlasMapInner({ layers = ["districts", "constituencies", "mandals", "villages"], initialLayer = "auto", selectedDistrictId, districtHref, palette = "bands", variant = "standard", month }: AtlasProps) {
  const router = useRouter();
  const [map, setMap] = useState<LMap | null>(null);
  const [mode, setMode] = useState<AtlasMode>(initialLayer);
  const [zoom, setZoom] = useState(6);
  const [geo, setGeo] = useState<Partial<Record<Exclude<AtlasLayer, "villages"> | "outline", FeatureCollection | null>>>({});
  const [villageIndex, setVillageIndex] = useState<VillageIndex | null | undefined>(undefined);
  const [villageFc, setVillageFc] = useState<FeatureCollection | null>(null);
  const [dStats, setDStats] = useState<Stats | null>(null);
  const [mStats, setMStats] = useState<Stats | null>(null);
  const [trail, setTrail] = useState<Trail>({});
  const [selected, setSelected] = useState<Selected | null>(null);
  const [mandalVillages, setMandalVillages] = useState<Array<{ lgdCode: string; name: string; gp: { id: string; name: string } | null }> | null>(null);
  const [fullscreen, setFullscreen] = useState(variant === "full");
  const [labels, setLabels] = useState(variant !== "compact");
  const [query, setQuery] = useState("");
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const gjRef = useRef<LGeoJSON | null>(null);
  const compact = variant === "compact";
  const hint = useCallback((m: string) => { setHintMsg(m); clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHintMsg(null), 1600); }, []);

  const villagesReady = !!(trail.mandal && villageIndex?.mandals?.[trail.mandal.key]);
  const layer: AtlasLayer = mode === "auto" ? layerForZoom(zoom, villagesReady) : mode;

  useEffect(() => { for (const k of ["outline", "districts"] as const) load<FeatureCollection>(FILES[k]).then((g) => setGeo((x) => ({ ...x, [k]: g }))); load<VillageIndex>(VILLAGE_INDEX).then(setVillageIndex); }, []);
  useEffect(() => { if (layer !== "villages" && geo[layer] === undefined) load<FeatureCollection>(FILES[layer]).then((g) => setGeo((x) => ({ ...x, [layer]: g }))); }, [layer, geo]);
  useEffect(() => { if (layer === "constituencies" && geo.mandals === undefined) load<FeatureCollection>(FILES.mandals).then((g) => setGeo((x) => ({ ...x, mandals: g }))); }, [layer, geo.mandals]);
  useEffect(() => { loadStats("districts", month).then(setDStats); }, [month]);
  useEffect(() => { if (layer !== "districts" && !mStats) loadStats("mandals", month).then(setMStats); }, [layer, month, mStats]);
  useEffect(() => {
    if (!trail.mandal || !villageIndex?.mandals?.[trail.mandal.key]) { setVillageFc(null); return; }
    load<FeatureCollection>(`/geo/villages/${trail.mandal.key}.geojson`).then(setVillageFc);
  }, [trail.mandal, villageIndex]);
  useEffect(() => { if (variant === "full") return; const k = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [variant]);
  useEffect(() => { const t = setTimeout(() => map?.invalidateSize(), 220); return () => clearTimeout(t); }, [fullscreen, map]);

  const districtIdByLgd = useMemo(() => new Map(Object.entries(dStats?.areas ?? {}).map(([code, s]) => [code, s.id])), [dStats]);

  // A district chosen in the page filters becomes the first breadcrumb.
  useEffect(() => {
    if (!map || !selectedDistrictId || !geo.districts || !dStats) return;
    const code = [...districtIdByLgd].find(([, id]) => id === selectedDistrictId)?.[0];
    const f = geo.districts.features.find((x) => x.properties?.lgdCode === code);
    if (!f) return;
    const b = L.geoJSON(f).getBounds();
    setTrail({ district: { key: String(code), name: String(f.properties?.name), bounds: b } });
    map.fitBounds(b, { padding: [16, 16], maxZoom: 9 });
  }, [map, selectedDistrictId, geo.districts, dStats, districtIdByLgd]);

  // What the active layer shows, narrowed to the breadcrumb (a district's constituencies, a constituency's mandals…).
  const fc = useMemo<FeatureCollection | null | undefined>(() => {
    if (layer === "villages") return villageFc;
    const base = geo[layer];
    if (!base) return base;
    const d = trail.district?.key, ac = trail.ac?.no;
    const keep = (f: Feature) => {
      const p = f.properties ?? {};
      if (layer === "constituencies") return !d || p.districtLgd === d;
      if (layer === "mandals") return ac ? p.acNo === ac : !d || p.districtLgd === d;
      return true;
    };
    return { ...base, features: base.features.filter(keep) };
  }, [layer, geo, trail.district, trail.ac, villageFc]);

  const aggFor = useCallback((f: Feature): Agg | null => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    if (layer === "districts") { const s = dStats?.areas[String(p.lgdCode)]; return s ? { score: s.score, band: s.band, wards: s.wards, localBodies: s.localBodies, reported: s.reported } : null; }
    if (layer === "mandals") return combine(((p.lgdCodes as string[]) ?? []).map((c) => mStats?.areas[c]));
    if (layer === "constituencies") {
      const ms = (geo.mandals?.features ?? []).filter((m) => m.properties?.acNo === p.acNo);
      return combine(ms.flatMap((m) => ((m.properties?.lgdCodes as string[]) ?? []).map((c) => mStats?.areas[c])));
    }
    return null;
  }, [layer, dStats, mStats, geo.mandals]);

  const keyOf = useCallback((f: Feature) => {
    const p = f.properties ?? {};
    return layer === "districts" ? String(p.lgdCode) : layer === "mandals" ? String((p.lgdCodes as string[])?.join(",") || p.sourceName) : layer === "constituencies" ? String(p.acNo) : String(p.lgdCode);
  }, [layer]);
  const fill = useCallback((a: Agg | null) => (palette === "blue" ? blueOf(a?.score ?? null) : a?.score == null ? NO_DATA : BAND_COLOR[a.band] ?? NO_DATA), [palette]);
  const style = useCallback((f?: Feature): PathOptions => {
    if (!f) return {};
    const isSel = selected?.key === keyOf(f) && selected.layer === layer;
    if (layer === "villages") return { color: isSel ? "#002e64" : "#ffffff", weight: isSel ? 2.5 : 0.8, fillColor: "#7fb3ff", fillOpacity: isSel ? 0.7 : 0.45 };
    return { color: isSel ? "#002e64" : "#ffffff", weight: isSel ? 3 : layer === "mandals" ? 0.7 : 1, fillColor: fill(aggFor(f)), fillOpacity: isSel ? 0.85 : 0.68 };
  }, [selected, keyOf, layer, aggFor, fill]);

  const describe = useCallback((f: Feature, bounds: L.LatLngBounds): Selected => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const agg = aggFor(f);
    if (layer === "districts") return { layer, key: keyOf(f), title: String(p.name), subtitle: `District, LGD code ${p.lgdCode}`, agg, districtId: districtIdByLgd.get(String(p.lgdCode)), bounds };
    if (layer === "mandals") {
      const codes = (p.lgdCodes as string[]) ?? [];
      return { layer, key: keyOf(f), title: String(p.name), subtitle: `Mandal in ${p.district ?? "-"} district${codes.length ? `, LGD ${codes.join(", ")}` : " (not listed in LGD)"}`, agg, districtId: districtIdByLgd.get(String(p.districtLgd)), mandalLgd: codes[0], bounds };
    }
    if (layer === "villages") return { layer, key: keyOf(f), title: String(p.name), subtitle: `Village${p.gp ? ` in ${p.gp} Gram Panchayat` : ""}, LGD code ${p.lgdCode}`, agg: null, bounds, note: "Scores are kept for Panchayat wards; a village belongs to the Gram Panchayat shown." };
    const res = String(p.reservation ?? "None");
    return { layer, key: keyOf(f), title: `${p.acNo}. ${p.name}`, subtitle: `Assembly constituency${res !== "None" ? ` (${res})` : ""}, ${p.loksabha} Lok Sabha seat, ${p.district ?? p.district2024} district`, agg, districtId: districtIdByLgd.get(String(p.districtLgd)), bounds,
      note: "The score combines the mandals whose centre lies in this constituency, so it is approximate." };
  }, [layer, aggFor, keyOf, districtIdByLgd]);

  /** Click = drill down one level: select, extend the breadcrumb, zoom in (auto mode then shows the next layer). */
  const drill = useCallback((f: Feature, b: L.LatLngBounds) => {
    const p = f.properties ?? {};
    setSelected(describe(f, b));
    if (layer === "districts") { setTrail({ district: { key: String(p.lgdCode), name: String(p.name), bounds: b } }); map?.fitBounds(b, { padding: [16, 16], maxZoom: 9 }); }
    else if (layer === "constituencies") { setTrail((t) => ({ district: t.district, ac: { key: String(p.acNo), no: Number(p.acNo), name: String(p.name), bounds: b } })); map?.fitBounds(b, { padding: [16, 16], maxZoom: 11 }); }
    else if (layer === "mandals") { const code = ((p.lgdCodes as string[]) ?? [])[0]; if (code) setTrail((t) => ({ district: t.district, ac: t.ac, mandal: { key: code, name: String(p.name).split(" · ")[0], bounds: b } })); map?.fitBounds(b, { padding: [16, 16], maxZoom: 13 }); }
    else setTrail((t) => ({ ...t, village: { key: String(p.lgdCode), name: String(p.name), bounds: b } }));
  }, [describe, layer, map]);

  const onEach = useCallback((f: Feature, l: Layer) => {
    const a = aggFor(f);
    const name = layer === "constituencies" ? `${f.properties?.acNo}. ${f.properties?.name}` : String(f.properties?.name ?? "");
    const detail = layer === "villages" ? (f.properties?.gp ? `${f.properties.gp} Gram Panchayat` : "Village") : a?.score != null ? `Score ${a.score}, ${a.band}` : "No score yet";
    l.bindTooltip(`<strong>${name.replace(/[<>&]/g, "")}</strong><br/>${String(detail).replace(/[<>&]/g, "")}`, { sticky: true, direction: "top", className: "atlas-tip" });
    l.on({
      mouseover: (e) => { (e.target as L.Path).setStyle({ weight: 2.5, color: "#002e64" }); (e.target as L.Path).bringToFront(); },
      mouseout: (e) => gjRef.current?.resetStyle(e.target),
      click: (e) => drill(f, (e.target as L.Polygon).getBounds()),
    });
  }, [aggFor, layer, drill]);

  // Villages of the selected mandal from the LGD directory (works even without village boundaries).
  useEffect(() => {
    if (!selected?.mandalLgd) { setMandalVillages(null); return; }
    let off = false;
    fetch(`/api/geo/villages?mandal=${selected.mandalLgd}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off) setMandalVillages(j?.data ?? []); }).catch(() => !off && setMandalVillages([]));
    return () => { off = true; };
  }, [selected?.mandalLgd]);

  const goTo = (level: keyof Trail | "state") => {
    setSelected(null);
    if (level === "state") { setTrail({}); map?.fitBounds(AP_BOUNDS as LatLngBoundsExpression, { padding: [8, 8] }); return; }
    const order: Array<keyof Trail> = ["district", "ac", "mandal", "village"];
    const keepTo = order.indexOf(level);
    setTrail((t) => Object.fromEntries(order.slice(0, keepTo + 1).filter((k) => t[k]).map((k) => [k, t[k]])) as Trail);
    const c = trail[level];
    if (c) map?.fitBounds(c.bounds, { padding: [16, 16], maxZoom: level === "district" ? 9 : level === "ac" ? 11 : 13 });
  };
  const locate = () => { if (!map) return; map.locate({ setView: true, maxZoom: 11 }); map.once("locationerror", () => hint("Location unavailable. Allow location access in your browser.")); map.once("locationfound", (e: L.LocationEvent) => L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#0059bc", fillOpacity: 1 }).addTo(map).bindTooltip("You are here").openTooltip()); };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !fc) return [];
    return fc.features.filter((f) => String(f.properties?.name ?? "").toLowerCase().includes(q) || String(f.properties?.acNo ?? "") === q).slice(0, 8);
  }, [query, fc]);
  const pick = (f: Feature) => { drill(f, L.geoJSON(f).getBounds()); setQuery(""); };

  const labelFeatures = useMemo(() => {
    if (!labels || !fc || !map) return [];
    if (layer === "districts") return zoom >= 7 ? fc.features : [];
    return zoom >= 8 ? fc.features.filter((f) => map.getBounds().intersects(L.geoJSON(f).getBounds())).slice(0, 120) : [];
  }, [labels, layer, zoom, fc, map]);
  const legend = palette === "blue" ? BLUE.map(([k, c]) => [k, c]) : Object.entries(BAND_COLOR);
  const ctl = "flex h-9 w-9 items-center justify-center rounded-md text-ink-900 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
  const crumbs: Array<[keyof Trail | "state", string]> = [["state", "Andhra Pradesh"], ...(["district", "ac", "mandal", "village"] as const).filter((k) => trail[k]).map((k) => [k, trail[k]!.name] as [keyof Trail, string])];
  const villagesAvailable = !!villageIndex && Object.keys(villageIndex.mandals ?? {}).length > 0;
  const tabs: AtlasMode[] = ["auto", ...layers.filter((l) => l !== "villages" || villagesAvailable)];

  return (
    <div className={cn("atlas isolate h-full w-full overflow-hidden rounded-lg border border-line", fullscreen && variant !== "full" && "fixed inset-0 z-[100] h-[100dvh] rounded-none border-0 bg-surface")} role="region" aria-label="Interactive map of Andhra Pradesh">
      <MapContainer bounds={AP_BOUNDS as LatLngBoundsExpression} boundsOptions={{ padding: [8, 8] }} zoomControl={false} preferCanvas minZoom={5} maxZoom={17}
        maxBounds={[[10.5, 74.5], [21.5, 87]]} className="leaflet-tiles-muted h-full w-full" doubleClickZoom keyboard>
        <TileLayer url={TILE} attribution={`${ATTR}; boundaries: project layers, Survey of India ref. (CC BY 4.0)${villageIndex?.attribution ? `; ${villageIndex.attribution}` : ""}`} />
        <Bridge onReady={setMap} />
        <ZoomWatch onZoom={setZoom} />
        <AutoResize />
        <GestureGuard active={variant !== "full" && !fullscreen} hint={hint} />
        {geo.outline && <GeoJSON key="outline" data={geo.outline} interactive={false} style={{ color: "#002e64", weight: 1.6, fill: false, opacity: 0.8 }} />}
        {trail.district && layer !== "districts" && geo.districts && (
          <GeoJSON key={`ctx-${trail.district.key}`} data={{ type: "FeatureCollection", features: geo.districts.features.filter((x) => x.properties?.lgdCode === trail.district!.key) } as FeatureCollection} interactive={false} style={{ color: "#002e64", weight: 2.4, fill: false }} />
        )}
        {fc && <GeoJSON key={`${layer}-${palette}-${trail.district?.key ?? ""}-${trail.ac?.key ?? ""}-${trail.mandal?.key ?? ""}-${dStats ? 1 : 0}-${mStats ? 1 : 0}-${selected?.key ?? ""}`} ref={gjRef} data={fc} style={style} onEachFeature={onEach} />}
        {labelFeatures.map((f, i) => <Label key={`${layer}-${i}`} feature={f} text={layer === "constituencies" ? String(f.properties?.name) : String(f.properties?.name).split(" · ")[0]} />)}
      </MapContainer>

      {/* Layer mode, breadcrumb and search */}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex flex-col items-start gap-2 pr-12">
        {tabs.length > 2 && (
          <div role="tablist" aria-label="Map layer" className="glass-strong pointer-events-auto flex max-w-full overflow-x-auto rounded-md p-1 text-[12.5px] font-semibold">
            {tabs.map((t) => (
              <button key={t} role="tab" aria-selected={mode === t} onClick={() => setMode(t)}
                className={cn("whitespace-nowrap rounded px-2.5 py-1.5 transition-colors", mode === t ? "bg-brand-600 text-white" : "text-ink-700 hover:text-brand-700")}>
                {t === "auto" ? `Auto (${LAYER_LABEL[layer]})` : LAYER_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        {crumbs.length > 1 && (
          <nav aria-label="Map location" className="glass-strong pointer-events-auto flex max-w-full flex-wrap items-center gap-0.5 rounded-md px-2 py-1 text-[12.5px]">
            {crumbs.map(([k, name], i) => (
              <span key={k} className="flex items-center">
                {i > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-ink-500" aria-hidden="true" />}
                {i < crumbs.length - 1 ? <button className="rounded px-1 font-medium text-brand-700 hover:underline" onClick={() => goTo(k)}>{name}</button> : <span className="px-1 font-semibold text-ink-900" aria-current="location">{name}</span>}
              </span>
            ))}
          </nav>
        )}
        {!compact && (
          <div className="pointer-events-auto relative w-full max-w-[16rem] sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find a ${layer === "constituencies" ? "constituency" : layer === "mandals" ? "mandal" : layer === "villages" ? "village" : "district"}`} aria-label={`Search ${LAYER_LABEL[layer]}`}
              className="glass-strong h-9 w-full rounded-md pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-brand-500" />
            {matches.length > 0 && (
              <ul className="glass-strong absolute mt-1 max-h-64 w-full overflow-y-auto rounded-md p-1 text-[13px]" role="listbox">
                {matches.map((f, i) => <li key={i}><button className="w-full rounded px-3 py-1.5 text-left hover:bg-brand-50" onClick={() => pick(f)}>{layer === "constituencies" ? `${f.properties?.acNo}. ` : ""}{String(f.properties?.name)}<span className="block text-[11px] text-ink-500">{String(f.properties?.district ?? f.properties?.gp ?? "")}</span></button></li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="glass-strong absolute right-2 top-2 z-[500] flex flex-col gap-0.5 rounded-md p-1" role="toolbar" aria-label="Map controls">
        <button className={ctl} onClick={() => map?.zoomIn()} aria-label="Zoom in" title="Zoom in"><Plus className="h-4 w-4" /></button>
        <button className={ctl} onClick={() => map?.zoomOut()} aria-label="Zoom out" title="Zoom out"><Minus className="h-4 w-4" /></button>
        <button className={ctl} onClick={() => goTo("state")} aria-label="Show all of Andhra Pradesh" title="Reset view"><Home className="h-4 w-4" /></button>
        {variant !== "full" && <button className={ctl} onClick={() => setFullscreen((v) => !v)} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>}
        {!compact && <button className={ctl} onClick={locate} aria-label="Show my location" title="My location"><Crosshair className="h-4 w-4" /></button>}
        {!compact && <button className={cn(ctl, labels && "bg-brand-50 text-brand-700")} onClick={() => setLabels((v) => !v)} aria-pressed={labels} aria-label="Toggle labels" title="Labels"><Tags className="h-4 w-4" /></button>}
      </div>

      {/* Legend */}
      <div className={cn("glass-strong absolute bottom-6 left-2 z-[500] rounded-md px-2.5 py-2 text-[11px] text-ink-700", compact && "hidden sm:block")}>
        <p className="mb-1 font-semibold text-ink-900">Development score</p>
        <ul className="space-y-0.5">{legend.map(([k, c]) => <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm" style={{ background: c }} aria-hidden="true" />{k}</li>)}
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm" style={{ background: palette === "blue" ? "#dbe6f5" : NO_DATA }} aria-hidden="true" />No data yet</li></ul>
        {dStats?.asOf && <p className="mt-1 text-[10px] text-ink-500">Scores for {dStats.asOf}</p>}
      </div>

      {fc === undefined && layer !== "villages" && <div className="absolute inset-0 z-[450] flex items-center justify-center"><span className="glass-strong flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading {LAYER_LABEL[layer].toLowerCase()}</span></div>}
      {layer === "villages" && !villageFc && mode === "villages" && <p className="glass-strong absolute inset-x-4 bottom-24 z-[460] rounded-md p-3 text-center text-sm">Choose a mandal first: click it on the Mandals layer, then switch to Villages.</p>}
      {fc === null && layer !== "villages" && <p className="glass-strong absolute inset-x-4 top-1/2 z-[460] rounded-md p-3 text-center text-sm">This boundary layer is not installed. See docs/MAPS.md.</p>}
      {hintMsg && <div className="pointer-events-none absolute inset-0 z-[600] flex items-center justify-center bg-navy-950/35"><p className="rounded-md bg-navy-900/90 px-4 py-2 text-sm font-medium text-white">{hintMsg}</p></div>}

      {/* Details of the selected area */}
      {selected && (
        <div className={cn("glass-strong absolute z-[550] rounded-lg p-3 text-[13px]", compact ? "bottom-2 right-2 w-[min(18rem,calc(100%-1rem))]" : "bottom-6 right-2 w-[min(21rem,calc(100%-1rem))]")} role="dialog" aria-label={`${selected.title} details`}>
          <button onClick={() => setSelected(null)} className="absolute right-2 top-2 rounded p-1 text-ink-500 hover:bg-muted" aria-label="Close details"><X className="h-4 w-4" /></button>
          <p className="pr-6 font-display text-[15px] font-semibold leading-tight text-ink-900">{selected.title}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-500">{selected.subtitle}</p>
          {selected.agg ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-muted p-1.5"><dt className="text-[10.5px] text-ink-500">Score</dt><dd className="font-display text-lg font-bold" style={{ color: selected.agg.score == null ? undefined : BAND_COLOR[selected.agg.band] }}>{selected.agg.score ?? "-"}</dd></div>
              <div className="rounded bg-muted p-1.5"><dt className="text-[10.5px] text-ink-500">Wards</dt><dd className="font-display text-lg font-bold">{selected.agg.wards.toLocaleString("en-IN")}</dd></div>
              <div className="rounded bg-muted p-1.5"><dt className="text-[10.5px] text-ink-500">Complaints</dt><dd className="font-display text-lg font-bold">{selected.agg.reported.toLocaleString("en-IN")}</dd></div>
            </dl>
          ) : selected.layer !== "villages" && <p className="mt-2 text-ink-500">No statistics for this area yet.</p>}
          {selected.agg && <p className="mt-1 text-[11.5px] text-ink-500">{selected.agg.localBodies.toLocaleString("en-IN")} Panchayats and municipalities, {selected.agg.band.toLowerCase()}</p>}
          {selected.note && <p className="mt-1 text-[11.5px] italic text-ink-500">{selected.note}</p>}
          {selected.layer === "mandals" && mandalVillages && (
            <details className="mt-2 rounded border border-line">
              <summary className="cursor-pointer px-2 py-1 text-[12px] font-semibold text-ink-900">{mandalVillages.length} villages in this mandal (LGD)</summary>
              <ul className="max-h-40 overflow-y-auto px-2 pb-2 text-[12px]">{mandalVillages.map((v) => <li key={v.lgdCode} className="flex justify-between gap-2 border-b border-line py-0.5 last:border-0"><span>{v.name}</span><span className="text-ink-500">{v.gp?.name ?? "no GP"}</span></li>)}</ul>
            </details>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => map?.fitBounds(selected.bounds, { padding: [24, 24] })}>Zoom to</button>
            {districtHref && selected.districtId && <button className="btn-primary btn-sm" onClick={() => router.push(districtHref.replace("{id}", encodeURIComponent(selected.districtId!)))}>Open district dashboard</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ feature, text }: { feature: Feature; text: string }) {
  const map = useMap();
  useEffect(() => {
    const c = L.geoJSON(feature).getBounds().getCenter();
    const m = L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: "atlas-label", html: `<span>${text.replace(/[<>&]/g, "")}</span>`, iconSize: [0, 0] }) }).addTo(map);
    return () => { m.remove(); };
  }, [map, feature, text]);
  return null;
}
