// Boundary geometry helpers: projection to SVG, simplification and LGD name matching.
// Pure module (no imports) — used by the map components and scripts/geo/prepare-boundaries.ts.

export type Position = [number, number]; // [lng, lat]
export type Ring = Position[];
export type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
export type GeoFeature = { type: "Feature"; properties: Record<string, unknown> | null; geometry: Geometry | null };
export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export function polygonsOf(g: Geometry | null): Ring[][] {
  if (!g) return [];
  return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
}

export function bbox(features: GeoFeature[]): BBox {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const f of features) for (const poly of polygonsOf(f.geometry)) for (const ring of poly) for (const [x, y] of ring) {
    if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y;
  }
  return [a, b, c, d];
}

/** Equirectangular projection scaled by cos(latitude) so shapes keep their proportions at Indian latitudes. */
export function makeProjector(box: BBox, width: number, height: number, pad = 8) {
  const [minX, minY, maxX, maxY] = box;
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * kx, h = maxY - minY;
  const s = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  const ox = (width - w * s) / 2, oy = (height - h * s) / 2;
  return (lng: number, lat: number): [number, number] => [ox + (lng - minX) * kx * s, oy + (maxY - lat) * s];
}

export function toSvgPath(g: Geometry | null, project: (lng: number, lat: number) => [number, number], precision = 1): string {
  const f = (n: number) => n.toFixed(precision);
  return polygonsOf(g).map((poly) => poly.map((ring) => ring.map(([x, y], i) => { const [px, py] = project(x, y); return `${i ? "L" : "M"}${f(px)} ${f(py)}`; }).join("") + "Z").join("")).join("");
}

function perpDist(p: Position, a: Position, b: Position) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker simplification of a closed ring (iterative; keeps at least 4 points). */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4 || tolerance <= 0) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = perpDist(ring[i], ring[s], ring[e]); if (d > max) { max = d; idx = i; } }
    if (idx > -1 && max > tolerance) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

export function simplifyGeometry(g: Geometry, tolerance: number, decimals = 5): Geometry {
  const r = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  const ring = (rg: Ring) => simplifyRing(rg, tolerance).map(([x, y]) => [r(x), r(y)] as Position);
  return g.type === "Polygon" ? { type: "Polygon", coordinates: g.coordinates.map(ring) } : { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(ring)) };
}

export const countPoints = (g: Geometry | null) => polygonsOf(g).reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);

/** Normalise a place name for matching ("Y.S.R. Kadapa District" → "ysrkadapa"). */
export const normName = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\bdistrict\b/g, "").replace(/[^a-z]/g, "");

/** Common alternative spellings in boundary datasets, keyed by the LGD district name. */
export const DISTRICT_ALIASES: Record<string, string[]> = {
  "Ananthapuramu": ["Anantapur", "Anantapuramu", "Ananthapur"],
  "Sri Potti Sriramulu Nellore": ["Nellore", "SPSR Nellore", "S.P.S.R. Nellore", "Sri Potti Sri Ramulu Nellore"],
  "Y.S.R. Kadapa": ["Kadapa", "Cuddapah", "YSR", "YSR Kadapa", "Y.S.R", "YSR District"],
  "NTR": ["N.T.R", "N T R", "NTR District"],
  "Dr. B.R. Ambedkar Konaseema": ["Konaseema", "Ambedkar Konaseema", "B.R. Ambedkar Konaseema", "Dr B R Ambedkar Konaseema"],
  "Alluri Sitharama Raju": ["Alluri Sitarama Raju", "ASR", "Alluri Seetharama Raju"],
  "Parvathipuram Manyam": ["Manyam", "Parvathipuram"],
  "Visakhapatnam": ["Vishakhapatnam", "Vizag", "Visakhapatanam"],
  "Sri Sathya Sai": ["Sri Satya Sai", "Sathya Sai", "Puttaparthi"],
  "Tirupati": ["Tirupathi"],
  "Vizianagaram": ["Vizianagram", "Vijayanagaram"],
  "Annamayya": ["Annamaya", "Annamayya District"],
};

export function matchDistrict(name: string, districts: Array<{ lgdCode: string; name: string }>): string | null {
  const n = normName(name);
  if (!n) return null;
  for (const d of districts) if (normName(d.name) === n) return d.lgdCode;
  for (const d of districts) if ((DISTRICT_ALIASES[d.name] ?? []).some((a) => normName(a) === n)) return d.lgdCode;
  return null;
}

// ── Spatial joins (used to place mandals in districts and constituencies) ──

export function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(pt: Position, g: Geometry | null): boolean {
  return polygonsOf(g).some(([outer, ...holes]) => pointInRing(pt, outer) && !holes.some((h) => pointInRing(pt, h)));
}

const ringArea = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };

/**
 * A point guaranteed to lie inside the geometry's largest polygon: the midpoint of the widest
 * horizontal run through it (centroids of concave shapes can fall outside).
 */
export function interiorPoint(g: Geometry | null): Position | null {
  const polys = polygonsOf(g);
  if (!polys.length) return null;
  const poly = polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const ys = poly[0].map((p) => p[1]);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  let best: { w: number; pt: Position } | null = null;
  for (let k = 1; k < 10; k++) {
    const y = minY + ((maxY - minY) * k) / 10;
    const xs: number[] = [];
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (!best || w > best.w) best = { w, pt: [(xs[i] + xs[i + 1]) / 2, y] };
    }
  }
  return best?.pt ?? poly[0][0];
}

/** Merge features sharing a key into one MultiPolygon each (e.g. a district stored as several pieces). */
export function mergeByKey(features: GeoFeature[], key: (f: GeoFeature) => string): Map<string, { first: GeoFeature; geometry: Geometry }> {
  const out = new Map<string, { first: GeoFeature; polys: Ring[][] }>();
  for (const f of features) {
    const k = key(f);
    const e = out.get(k) ?? { first: f, polys: [] };
    e.polys.push(...polygonsOf(f.geometry));
    out.set(k, e);
  }
  return new Map([...out].map(([k, e]) => [k, { first: e.first, geometry: e.polys.length === 1 ? { type: "Polygon", coordinates: e.polys[0] } as Geometry : { type: "MultiPolygon", coordinates: e.polys } as Geometry }]));
}

export function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}

/**
 * Dissolve polygons that share borders (e.g. mandals → district) by cancelling every edge that
 * appears twice. Exact for topologically clean data (shared borders use identical vertices).
 */
export function dissolve(geoms: Array<Geometry | null>, precision = 6): Geometry | null {
  const f = 10 ** precision;
  const k = (p: Position) => `${Math.round(p[0] * f)},${Math.round(p[1] * f)}`;
  const signed = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; }; // > 0 ⇒ counter-clockwise
  const count = new Map<string, number>();
  const directed: Array<[Position, Position]> = [];
  for (const g of geoms) for (const [outer, ...holes] of polygonsOf(g)) {
    for (const [ring, wantCcw] of [[outer, true], ...holes.map((h) => [h, false] as const)] as Array<[Ring, boolean]>) {
      const r = (signed(ring) > 0) === wantCcw ? ring : [...ring].reverse();
      for (let i = 0; i + 1 < r.length; i++) {
        if (k(r[i]) === k(r[i + 1])) continue;
        directed.push([r[i], r[i + 1]]);
        const u = [k(r[i]), k(r[i + 1])].sort().join("|");
        count.set(u, (count.get(u) ?? 0) + 1);
      }
    }
  }
  const boundary = directed.filter(([a, b]) => count.get([k(a), k(b)].sort().join("|")) === 1);
  const from = new Map<string, Array<[Position, Position]>>();
  for (const e of boundary) from.set(k(e[0]), [...(from.get(k(e[0])) ?? []), e]);
  const rings: Ring[] = [];
  const used = new Set<[Position, Position]>();
  for (const start of boundary) {
    if (used.has(start)) continue;
    const ring: Ring = [start[0]];
    let e: [Position, Position] | undefined = start;
    while (e && !used.has(e)) {
      used.add(e); ring.push(e[1]);
      if (k(e[1]) === k(ring[0])) break;
      e = (from.get(k(e[1])) ?? []).find((x) => !used.has(x));
    }
    if (ring.length >= 4 && k(ring[ring.length - 1]) === k(ring[0])) rings.push(ring);
  }
  const outers = rings.filter((r) => signed(r) > 0).map((r) => [r] as Ring[]);
  for (const h of rings.filter((r) => signed(r) <= 0)) (outers.find((o) => pointInRing(h[0], o[0])) ?? outers[0])?.push(h);
  if (!outers.length) return null;
  return outers.length === 1 ? { type: "Polygon", coordinates: outers[0] } : { type: "MultiPolygon", coordinates: outers };
}

/** Census 2011 village code from a boundary feature's properties (DataMeet and similar files), as an integer string. */
export function villageCensusCode(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null;
  for (const k of ["village_code_2011", "census2011", "censuscode", "census_code", "VILLAGE_CO", "C_CODE11", "pc11_village_id", "vill_code", "VILL_CODE"]) {
    const v = props[k];
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > 0) return String(n);
  }
  return null;
}
