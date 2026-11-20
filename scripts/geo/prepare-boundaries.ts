/**
 * Install boundary layers for the maps (docs/MAPS.md). Every input is optional; give at least one.
 *
 *   npm run geo:prepare -- \
 *     --districts      data/geo/source/AndhraPradesh_Districts.geojson   (GeoJSON or .shp)
 *     --state          data/geo/source/India-States.shp                  (GeoJSON or .shp; picks --state-name)
 *     --mandals        data/geo/source/MANDAL.geojson
 *     --constituencies data/geo/source/Constituencies_AndhraPradesh_2024.geojson
 *     [--constituency-meta data/geo/source/Final_Andhra_Constituencies_2024.json] [--tolerance 0.0007]
 *
 * Writes simplified layers to public/geo/ — districts (matched to LGD codes), the state outline,
 * mandals (matched to LGD sub-district codes, placed in districts and assembly constituencies by
 * position) and assembly constituencies — plus data/geo/boundaries-report.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseCsv } from "../../src/lib/domain/csv-parse";
import { bbox, countPoints, dissolve, interiorPoint, matchDistrict, mergeByKey, normName, pointInGeometry, simplifyGeometry, villageCensusCode, type GeoFeature, type Geometry, type Position } from "../../src/lib/domain/geo";
import { matchMandal, type SubDistrict } from "../../src/lib/domain/mandal-match";
import { readDbf, readShp } from "../../src/lib/domain/shapefile";

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
const tol = Number(arg("tolerance") ?? 0.0007);
const outDir = arg("out") ?? "public/geo";
const lgdDir = arg("lgd") ?? process.env.LGD_DATA_DIR ?? "data/lgd/andhra-pradesh";
const stateName = arg("state-name") ?? "Andhra Pradesh";
const inputs = { districts: arg("districts"), state: arg("state"), mandals: arg("mandals"), constituencies: arg("constituencies"), meta: arg("constituency-meta"), villages: arg("villages") };

function fail(msg: string): never { console.error(`\n✖ ${msg}\n`); process.exit(1); }
if (!inputs.districts && !inputs.state && !inputs.mandals && !inputs.constituencies && !inputs.villages) {
  fail("Give at least one input, e.g.\n  npm run geo:prepare -- --districts data/geo/source/AndhraPradesh_Districts.geojson\n(see docs/MAPS.md — \"path/to/…\" in examples is a placeholder for your own file path)");
}
for (const [k, p] of Object.entries(inputs)) if (p && !existsSync(p)) fail(`--${k}: file not found: ${p}\nCheck the path (relative to the project folder) — "path/to/…" in the docs is a placeholder.`);

function load(path: string): GeoFeature[] {
  let feats: GeoFeature[];
  if (/\.shp$/i.test(path)) {
    const dbfPath = path.replace(/\.shp$/i, ".dbf");
    const cpg = path.replace(/\.shp$/i, ".cpg");
    const enc = existsSync(cpg) ? readFileSync(cpg, "utf8").trim().toLowerCase().replace("utf8", "utf-8") : "utf-8";
    const geoms = readShp(readFileSync(path));
    const rows = existsSync(dbfPath) ? readDbf(readFileSync(dbfPath), enc === "utf-8" ? "utf-8" : "latin1") : [];
    feats = geoms.map((g, i) => ({ type: "Feature", properties: rows[i] ?? {}, geometry: g }));
  } else {
    const j = JSON.parse(readFileSync(path, "utf8"));
    feats = j.type === "FeatureCollection" ? j.features : j.type === "Feature" ? [j] : [{ type: "Feature", properties: {}, geometry: j }];
  }
  return feats.filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"));
}
function checkWgs84(path: string, feats: GeoFeature[], minX = 70, maxX = 90) {
  const [a, b, c, d] = bbox(feats);
  if (!(a > minX - 2 && c < maxX + 8 && b > 5 && d < 38)) fail(`${path}: coordinates ${[a, b, c, d].map((n) => n.toFixed(2))} are not WGS84 longitude/latitude. Re-project to EPSG:4326 (e.g. ogr2ogr -t_srs EPSG:4326).`);
}
const prop = (f: GeoFeature, ...keys: string[]) => { for (const k of keys) { const v = f.properties?.[k]; if (v != null && String(v).trim()) return String(v).trim(); } return ""; };
const title = (s: string) => s.toLowerCase().replace(/(^|[\s(.-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
const write = (file: string, features: GeoFeature[], extra: Record<string, unknown> = {}) => {
  writeFileSync(join(outDir, file), JSON.stringify({ type: "FeatureCollection", properties: { generatedAt: new Date().toISOString(), ...extra }, features }));
  const pts = features.reduce((n, f) => n + countPoints(f.geometry), 0);
  console.log(`  → ${join(outDir, file)}: ${features.length} features, ${pts.toLocaleString("en-IN")} points`);
};
mkdirSync(outDir, { recursive: true });
const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), tolerance: tol, sources: Object.fromEntries(Object.entries(inputs).filter(([, v]) => v).map(([k, v]) => [k, basename(v!)])) };
const lgdDistricts = parseCsv(readFileSync(join(lgdDir, "districts.csv"), "utf8")).map((d) => ({ lgdCode: d.lgdCode, name: d.name }));
const lgdSubs = parseCsv(readFileSync(join(lgdDir, "subdistricts.csv"), "utf8"));
const subs: SubDistrict[] = lgdSubs.map((x) => ({ lgdCode: x.lgdCode, name: x.name, districtCode: x.districtCode }));
const subBy = new Map(subs.map((x) => [x.lgdCode, x]));
const hq = JSON.parse(readFileSync("data/geo/district-hq.json", "utf8")) as Record<string, { lat: number; lng: number }>;
const dName = (code: string | null | undefined) => lgdDistricts.find((d) => d.lgdCode === code)?.name ?? null;

// ── Source district shapes (used as-is, or only as hints when mandals are supplied) ──
let sourceDistricts: Array<{ lgdCode: string; geometry: Geometry }> = [];
if (inputs.districts) {
  console.log(`Districts: ${inputs.districts}`);
  const feats = load(inputs.districts); checkWgs84(inputs.districts, feats);
  const codeProp = arg("code-prop"), nameProp = arg("name-prop");
  const unmatched = new Set<string>();
  const keyed = feats.map((f) => {
    const code = codeProp ? prop(f, codeProp) : prop(f, "lgdCode", "lgd_code", "LGD_Code", "dt_lgd");
    const name = nameProp ? prop(f, nameProp) : prop(f, "district_name", "NEW_DIST", "name", "NAME", "dtname", "DISTRICT", "District", "dist_name", "shapeName");
    const lgdCode = lgdDistricts.some((d) => d.lgdCode === code) ? code : matchDistrict(name, lgdDistricts);
    if (!lgdCode) unmatched.add(name || "(no name)");
    return { ...f, properties: { ...f.properties, __code: lgdCode ?? "" } };
  }).filter((f) => f.properties.__code);
  sourceDistricts = [...mergeByKey(keyed, (f) => String(f.properties!.__code))].map(([lgdCode, m]) => ({ lgdCode, geometry: m.geometry }));
  report.sourceDistricts = { features: feats.length, districts: sourceDistricts.length, unmatched: [...unmatched], lgdWithoutShape: lgdDistricts.filter((d) => !sourceDistricts.some((x) => x.lgdCode === d.lgdCode)).map((d) => d.name) };
  console.log(`  ${sourceDistricts.length} districts in the file${unmatched.size ? `; unmatched: ${[...unmatched].join(", ")}` : ""}`);
}
const sourceDistrictAt = (pt: Position | null) => (pt ? sourceDistricts.find((d) => pointInGeometry(pt, d.geometry))?.lgdCode ?? null : null);
const nearestHq = (pt: Position | null, codes: string[]) => (pt ? codes.map((c) => ({ c, d: hq[c] ? (hq[c].lng - pt[0]) ** 2 + (hq[c].lat - pt[1]) ** 2 : Infinity })).sort((a, b) => a.d - b.d)[0]?.c : codes[0]);

// ── Assembly constituencies (raw shapes, for mandal → constituency) ─────────
let acRaw: Array<{ acNo: number; first: GeoFeature; geometry: Geometry }> = [];
if (inputs.constituencies) {
  const feats = load(inputs.constituencies); checkWgs84(inputs.constituencies, feats);
  acRaw = [...mergeByKey(feats, (f) => String(Math.round(Number(prop(f, "ac_no", "AC_NO", "ac_number")))))].map(([k, m]) => ({ acNo: Number(k), first: m.first, geometry: m.geometry })).filter((a) => Number.isFinite(a.acNo) && a.acNo > 0);
}

// ── Mandals → LGD sub-districts; then current districts dissolved from mandals ──
let districtShapes: Array<{ lgdCode: string; name: string; geometry: Geometry }> = [];
let mandalOut: GeoFeature[] = [];
if (inputs.mandals) {
  console.log(`Mandals: ${inputs.mandals}`);
  const feats = load(inputs.mandals); checkWgs84(inputs.mandals, feats);
  const methods: Record<string, number> = {};
  const unmatched: string[] = [];
  const cache = new Map<string, ReturnType<typeof matchMandal>>();
  const byDistrict = new Map<string, Geometry[]>();
  for (const f of feats) {
    const raw = prop(f, "DMNAME", "mandal_name", "MANDAL", "Mandal", "name", "NAME", "sdtname");
    const pt = interiorPoint(f.geometry);
    const hint = sourceDistrictAt(pt);
    const prefer = (c: SubDistrict[]) => c.find((x) => x.districtCode === hint) ?? subBy.get(c.find((x) => x.districtCode === nearestHq(pt, c.map((y) => y.districtCode)))?.lgdCode ?? "");
    const ck = `${raw}|${hint}`;
    const m = cache.get(ck) ?? matchMandal(raw, subs, prefer, hint);
    cache.set(ck, m);
    methods[m.method ?? "unmatched"] = (methods[m.method ?? "unmatched"] ?? 0) + 1;
    if (!m.codes.length) unmatched.push(`${title(raw)} (${title(prop(f, "DNAME"))})`);
    const districtCode = m.codes.length ? subBy.get(m.codes[0])!.districtCode : hint ?? nearestHq(pt, Object.keys(hq).filter((k) => !k.startsWith("_")))!;
    // Shapes with no LGD mandal (e.g. Bhadrachalam, now in Telangana) stay out of district outlines.
    if (m.codes.length) byDistrict.set(districtCode, [...(byDistrict.get(districtCode) ?? []), f.geometry!]);
    const names = m.codes.map((c) => subBy.get(c)!.name);
    mandalOut.push({ type: "Feature", properties: { lgdCodes: m.codes, lgdCode: m.codes[0] ?? null, name: names.length ? names.join(" · ") : title(raw), sourceName: title(raw), districtLgd: districtCode, district: dName(districtCode), acNo: pt ? acRaw.find((a) => pointInGeometry(pt, a.geometry))?.acNo ?? null : null }, geometry: f.geometry });
  }
  districtShapes = lgdDistricts.filter((d) => byDistrict.has(d.lgdCode)).map((d) => ({ lgdCode: d.lgdCode, name: d.name, geometry: dissolve(byDistrict.get(d.lgdCode)!)! })).filter((d) => d.geometry);
  const covered = new Set(mandalOut.flatMap((f) => f.properties!.lgdCodes as string[]));
  report.mandals = { features: feats.length, methods, unmatched, lgdMandalsWithoutShape: subs.filter((x) => !covered.has(x.lgdCode)).map((x) => `${x.name} (${dName(x.districtCode)})`) };
  console.log(`  methods: ${JSON.stringify(methods)}`);
  if (unmatched.length) console.log(`  unmatched (${unmatched.length}): ${unmatched.join(", ")}`);
  write("andhra-pradesh-mandals.geojson", mandalOut, { source: basename(inputs.mandals) });
} else if (sourceDistricts.length) {
  districtShapes = sourceDistricts.map((d) => ({ lgdCode: d.lgdCode, name: dName(d.lgdCode)!, geometry: simplifyGeometry(d.geometry, tol) }));
}

// ── Districts output ─────────────────────────────────────────────────────────
if (districtShapes.length) {
  write("andhra-pradesh-districts.geojson", districtShapes.map((d) => ({ type: "Feature", properties: { lgdCode: d.lgdCode, name: d.name }, geometry: d.geometry })),
    { source: inputs.mandals ? `dissolved from ${basename(inputs.mandals)} by current LGD district` : basename(inputs.districts ?? "") });
  const missing = lgdDistricts.filter((d) => !districtShapes.some((x) => x.lgdCode === d.lgdCode)).map((d) => d.name);
  report.districts = { districts: districtShapes.length, parts: Object.fromEntries(districtShapes.map((d) => [d.name, d.geometry.type === "Polygon" ? 1 : d.geometry.coordinates.length])), lgdWithoutShape: missing, method: inputs.mandals ? "mandals dissolved by LGD district" : "source district file" };
  if (missing.length) console.warn(`  LGD districts without a shape: ${missing.join(", ")}`);
}
const districtAt = (pt: Position | null) => (pt ? districtShapes.find((d) => pointInGeometry(pt, d.geometry)) : undefined);

// ── State outline ────────────────────────────────────────────────────────────
if (inputs.state) {
  console.log(`State outline: ${inputs.state}`);
  const feats = load(inputs.state); checkWgs84(inputs.state, feats);
  const want = normName(stateName);
  const pick = feats.filter((f) => Object.values(f.properties ?? {}).some((v) => normName(String(v)) === want));
  if (!pick.length) fail(`${inputs.state}: no feature has a property equal to "${stateName}". Use --state-name.`);
  const merged = mergeByKey(pick, () => "state").get("state")!;
  // Kept as a reference layer: the outline built from current mandals is authoritative for the app
  // (the Survey of India/DataMeet state file predates the 2014 transfer of Khammam mandals).
  write(inputs.mandals ? "andhra-pradesh-soi.geojson" : "andhra-pradesh.geojson", [{ type: "Feature", properties: { name: stateName, source: basename(inputs.state) }, geometry: simplifyGeometry(merged.geometry, tol * 0.7) }], { source: basename(inputs.state), attribution: "Survey of India reference data via DataMeet, CC BY 4.0" });
  report.referenceOutline = { source: basename(inputs.state), file: inputs.mandals ? "andhra-pradesh-soi.geojson" : "andhra-pradesh.geojson" };
}
if (inputs.mandals) {
  const g = dissolve(districtShapes.map((d) => d.geometry));
  if (g) write("andhra-pradesh.geojson", [{ type: "Feature", properties: { name: stateName, source: "outline of the 28 current districts (dissolved mandals)" }, geometry: g }]);
}

// ── Assembly constituencies output ──────────────────────────────────────────
if (acRaw.length) {
  console.log(`Assembly constituencies: ${inputs.constituencies}`);
  const meta = inputs.meta ? (JSON.parse(readFileSync(inputs.meta, "utf8")) as Array<Record<string, unknown>>) : [];
  const metaBy = new Map(meta.map((m) => [Math.round(Number(m.ac_no)), m]));
  const out: GeoFeature[] = acRaw.map((a) => {
    const md = metaBy.get(a.acNo) ?? {};
    const d = districtAt(interiorPoint(a.geometry));
    return { type: "Feature" as const, properties: {
      acNo: a.acNo, name: String(md.ac_name ?? (prop(a.first, "ac_name") || title(prop(a.first, "AC_NAME")))),
      reservation: String(md.reservation ?? (prop(a.first, "reservation") || "None")),
      loksabha: String(md.loksabha_constituency_name ?? prop(a.first, "loksabha_constituency_name")),
      district2024: String(md.district_name ?? prop(a.first, "district_name")),
      districtLgd: d?.lgdCode ?? null, district: d?.name ?? null,
    }, geometry: simplifyGeometry(a.geometry, tol * 0.4) };
  }).sort((x, y) => Number(x.properties!.acNo) - Number(y.properties!.acNo));
  write("andhra-pradesh-assembly-constituencies.geojson", out, { source: basename(inputs.constituencies!) });
  report.constituencies = { constituencies: out.length, withoutMetadata: out.filter((f) => !metaBy.has(Number(f.properties!.acNo))).length, mandalsAssigned: mandalOut.filter((f) => f.properties!.acNo != null).length };
}

// ── Villages (Census 2011 boundaries, e.g. DataMeet, linked to LGD by Census code) ──
if (inputs.villages) {
  console.log(`Villages: ${inputs.villages}`);
  const feats = load(inputs.villages); checkWgs84(inputs.villages, feats);
  const lgdVillages = parseCsv(readFileSync(join(lgdDir, "villages.csv"), "utf8"));
  const lbName = new Map(parseCsv(readFileSync(join(lgdDir, "local-bodies.csv"), "utf8")).map((l) => [l.lgdCode, l.name]));
  const byCensus = new Map<string, Record<string, string>>();
  for (const v of lgdVillages) { const c = Number(String(v.census2011 ?? "").replace(/\D/g, "")); if (c > 0) byCensus.set(String(c), v); }
  const perMandal = new Map<string, GeoFeature[]>();
  let matched = 0;
  for (const f of feats) {
    const code = villageCensusCode(f.properties);
    const v = code ? byCensus.get(code) : undefined;
    if (!v || !v.subDistrictCode) continue;
    matched++;
    perMandal.set(v.subDistrictCode, [...(perMandal.get(v.subDistrictCode) ?? []), { type: "Feature", properties: { lgdCode: v.lgdCode, name: v.name, census2011: code, gpCode: v.gpCode || null, gp: lbName.get(v.gpCode) ?? null, mandalLgd: v.subDistrictCode }, geometry: simplifyGeometry(f.geometry!, tol * 0.35) }]);
  }
  mkdirSync(join(outDir, "villages"), { recursive: true });
  for (const [m, list] of perMandal) writeFileSync(join(outDir, "villages", `${m}.geojson`), JSON.stringify({ type: "FeatureCollection", features: list }));
  writeFileSync(join(outDir, "villages", "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), source: basename(inputs.villages), attribution: "Village boundaries: Indian Village Boundaries Project by DataMeet (ODbL)", matched, total: feats.length, mandals: Object.fromEntries([...perMandal].map(([k, v]) => [k, v.length])) }));
  report.villages = { features: feats.length, matchedToLgd: matched, mandalFiles: perMandal.size, unmatched: feats.length - matched };
  console.log(`  ${matched}/${feats.length} village shapes linked to LGD by Census 2011 code → ${perMandal.size} files in ${join(outDir, "villages")}`);
}

report.attribution = "Boundaries: project-supplied Andhra Pradesh district, mandal and assembly-constituency layers; state outline: Survey of India reference data (via DataMeet), CC BY 4.0.";
mkdirSync("data/geo", { recursive: true });
writeFileSync("data/geo/boundaries-report.json", JSON.stringify(report, null, 2) + "\n");
console.log("\nReport: data/geo/boundaries-report.json");
