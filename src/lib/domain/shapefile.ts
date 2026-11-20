// Minimal ESRI Shapefile (.shp polygons) and dBase (.dbf) reader. Pure; no dependencies.
// Supports shape types 5 (Polygon), 15 (PolygonZ) and 25 (PolygonM); Z/M values are ignored.
import type { Geometry, Ring } from "./geo";

/** Signed area; > 0 for counter-clockwise rings. */
const signedArea = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; };

function ringContains(ring: Ring, [x, y]: [number, number]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function readShp(input: ArrayBuffer | Uint8Array): Array<Geometry | null> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getInt32(0, false) !== 9994) throw new Error("Not a shapefile (.shp): bad file code");
  const end = v.getInt32(24, false) * 2;
  const out: Array<Geometry | null> = [];
  let pos = 100;
  while (pos + 8 <= Math.min(end, bytes.byteLength)) {
    const len = v.getInt32(pos + 4, false) * 2;
    const c = pos + 8;
    const type = v.getInt32(c, true);
    if (type === 0) { out.push(null); pos = c + len; continue; }
    if (type !== 5 && type !== 15 && type !== 25) throw new Error(`Unsupported shape type ${type}; only polygon shapefiles are supported`);
    const nParts = v.getInt32(c + 36, true), nPoints = v.getInt32(c + 40, true);
    const parts: number[] = [];
    for (let i = 0; i < nParts; i++) parts.push(v.getInt32(c + 44 + 4 * i, true));
    const p0 = c + 44 + 4 * nParts;
    const rings: Ring[] = [];
    for (let i = 0; i < nParts; i++) {
      const from = parts[i], to = i + 1 < nParts ? parts[i + 1] : nPoints;
      const ring: Ring = [];
      for (let k = from; k < to; k++) ring.push([v.getFloat64(p0 + 16 * k, true), v.getFloat64(p0 + 16 * k + 8, true)]);
      if (ring.length >= 4) rings.push(ring);
    }
    // Shapefile convention: outer rings clockwise (signedArea < 0 here), holes counter-clockwise.
    // Holes join the outer ring that contains them.
    const polys: Ring[][] = [];
    for (const r of rings) {
      if (signedArea(r) < 0 || polys.length === 0) polys.push([r]);
      else (polys.find((p) => ringContains(p[0], r[0])) ?? polys[polys.length - 1]).push(r);
    }
    out.push(polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys });
    pos = c + len;
  }
  return out;
}

export function readDbf(input: ArrayBuffer | Uint8Array, encoding = "utf-8"): Record<string, string>[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = v.getUint32(4, true), headerLen = v.getUint16(8, true), recLen = v.getUint16(10, true);
  const dec = new TextDecoder(encoding);
  const fields: Array<{ name: string; len: number }> = [];
  for (let off = 32; off < headerLen - 1 && bytes[off] !== 0x0d; off += 32) {
    let name = "";
    for (let i = 0; i < 11 && bytes[off + i]; i++) name += String.fromCharCode(bytes[off + i]);
    fields.push({ name, len: bytes[off + 16] });
  }
  const rows: Record<string, string>[] = [];
  for (let r = 0; r < n; r++) {
    let off = headerLen + r * recLen;
    if (bytes[off] === 0x2a) continue; // deleted record
    off += 1;
    const row: Record<string, string> = {};
    for (const f of fields) { row[f.name] = dec.decode(bytes.subarray(off, off + f.len)).replace(/\0/g, "").trim(); off += f.len; }
    rows.push(row);
  }
  return rows;
}
