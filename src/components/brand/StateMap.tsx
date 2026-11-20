import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bbox, makeProjector, simplifyGeometry, toSvgPath, type GeoFeature } from "@/lib/domain/geo";
import { APOutline } from "./APOutline";

const W = 345, H = 290;
const cache = new Map<string, { mtime: number; features: GeoFeature[] }>();

function read(file: string): GeoFeature[] | null {
  const path = join(process.cwd(), "public", "geo", file);
  if (!existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.features;
  try {
    // Simplified once per file: at this size 0.01° is under half a pixel, and the inline SVG shrinks
    // from about 180 KB to a fraction of that.
    const features = ((JSON.parse(readFileSync(path, "utf8")).features ?? []) as GeoFeature[])
      .map((f) => (f.geometry ? { ...f, geometry: simplifyGeometry(f.geometry, 0.01, 4) } : f));
    cache.set(file, { mtime, features });
    return features;
  } catch { return null; }
}

export const boundariesInstalled = () => !!read("andhra-pradesh.geojson")?.length;

/**
 * Andhra Pradesh silhouette from the installed boundaries (as in the reference design): the state in
 * blue, faint district lines, the featured district lightly highlighted and a pin at its headquarters.
 * Falls back to the clearly labelled illustrative outline when no boundary files are installed.
 */
export function StateMap({ highlightLgd, pin, className = "" }: { highlightLgd?: string | null; pin?: { lat: number; lon: number; title: string }; className?: string }) {
  const outline = read("andhra-pradesh.geojson");
  const districts = read("andhra-pradesh-districts.geojson") ?? [];
  if (!outline?.length) return <APOutline className={className} pin={pin} />;
  const project = makeProjector(bbox(outline), W, H, 6);
  const pp = pin ? project(pin.lon, pin.lat) : null;
  const hl = districts.find((f) => String(f.properties?.lgdCode ?? "") === highlightLgd);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" className={className}
      aria-label={`Map of Andhra Pradesh${hl ? ` with ${String(hl.properties?.name)} district highlighted` : ""}${pin ? `, ${pin.title} marked` : ""}`}>
      <defs>
        <linearGradient id="smg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f8cf0" /><stop offset="1" stopColor="#1557c0" /></linearGradient>
        <filter id="sms" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#002e64" floodOpacity="0.25" /></filter>
      </defs>
      <g filter="url(#sms)">{outline.map((f, i) => <path key={i} d={toSvgPath(f.geometry, project)} fill="url(#smg)" />)}</g>
      {hl && <path d={toSvgPath(hl.geometry, project)} fill="#7fb3ff" fillOpacity={0.75} />}
      <g fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={0.6} strokeLinejoin="round">
        {districts.map((f, i) => <path key={i} d={toSvgPath(f.geometry, project)}><title>{String(f.properties?.name ?? "")}</title></path>)}
      </g>
      {pp && (
        <g transform={`translate(${pp[0].toFixed(1)} ${pp[1].toFixed(1)})`}>
          <circle r="11" fill="#de0d22" opacity="0.22"><animate attributeName="r" values="7;14;7" dur="2.4s" repeatCount="indefinite" /></circle>
          <path d="M0 2 C-7 -6 -7 -15 0 -15 C7 -15 7 -6 0 2Z" fill="#de0d22" stroke="#fff" strokeWidth="1.2" /><circle cy="-9" r="2.6" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
