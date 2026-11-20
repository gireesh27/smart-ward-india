#!/usr/bin/env node
/**
 * LGD (Local Government Directory, lgdirectory.gov.in) → normalised CSV converter.
 *
 * Reads the "Excel" exports LGD produces (Excel 2003 XML / SpreadsheetML, .xls
 * extension) with a streaming, dependency-free parser, so even the 270 MB PRI
 * wards export converts on a laptop.
 *
 *   node scripts/lgd/convert.mjs --in <folder with LGD .xls files> --out data/lgd/andhra-pradesh
 *
 * Outputs districts.csv, subdistricts.csv, local-bodies.csv, wards.csv,
 * villages.csv and report.json (counts + data-quality findings).
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : d; };
const IN = arg("in", "data/lgd/raw");
const OUT = arg("out", "data/lgd/andhra-pradesh");
const STATE = { code: arg("state-code", "28"), name: arg("state-name", "Andhra Pradesh") };

// ── Streaming SpreadsheetML reader ───────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const CELL = /<(?:ss:)?Cell\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/g;
const DATA = /<(?:ss:)?Data\b[^>]*>([\s\S]*?)<\/(?:ss:)?Data>/;

function parseRow(block) {
  const out = [];
  CELL.lastIndex = 0;
  let m;
  while ((m = CELL.exec(block))) {
    const idx = /(?:ss:)?Index="(\d+)"/.exec(m[1]);
    if (idx) while (out.length < Number(idx[1]) - 1) out.push("");
    const d = DATA.exec(m[3] ?? "");
    out.push(d ? clean(decode(d[1])) : "");
    const merge = /(?:ss:)?MergeAcross="(\d+)"/.exec(m[1]);
    if (merge) for (let i = 0; i < Number(merge[1]); i++) out.push("");
  }
  return out;
}

async function* rows(path) {
  let buf = "";
  for await (const chunk of createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 })) {
    buf += chunk;
    let pos = 0, end;
    while ((end = buf.indexOf("</Row>", pos)) !== -1) {
      const start = buf.lastIndexOf("<Row", end);
      yield parseRow(buf.slice(start, end));
      pos = end + 6;
    }
    buf = buf.slice(pos);
  }
}

/** Find the header row, then yield records keyed by normalised header names (duplicates get #2, #3…). */
async function* records(path) {
  let headers = null;
  for await (const r of rows(path)) {
    if (!headers) {
      if (/^(s\.?\s?no\.?|state code)$/i.test(r[0] ?? "")) {
        const seen = {};
        headers = r.map((h) => { const k = h.toLowerCase().replace(/\(in (english|local)\)/g, "").replace(/\s+/g, " ").trim(); seen[k] = (seen[k] ?? 0) + 1; return seen[k] > 1 ? `${k}#${seen[k]}` : k; });
      }
      continue;
    }
    if (r.every((v) => !v) || r[0] === "" && r.slice(1).every((v) => !v || /^\(in /i.test(v))) continue; // blank / "(In English)" sub-header
    const rec = {};
    headers.forEach((h, i) => (rec[h] = r[i] ?? ""));
    yield rec;
  }
  if (!headers) throw new Error(`No header row found in ${path}`);
}

function need(rec, keys, file) {
  for (const k of keys) if (!(k in rec)) throw new Error(`${file}: expected column "${k}" — LGD format may have changed. Columns: ${Object.keys(rec).join(", ")}`);
}

// ── Input discovery (duplicate downloads like "…_1.xls" are ignored) ────────
const KINDS = {
  districts: /^districtofSpecificState/i, subdistricts: /^subDistrictofSpecificState/i, blocks: /^blockofspecificState/i,
  blockVillages: /^allBlockStateWithCoveredVillage/i, villages: /^villageofSpecificState/i, villageGp: /^villageGramPanchayatMapping/i,
  priWards: /^priWards/i, ulbs: /^ulbSpecificState/i, ulbWardsCov: /^uLBWardforStateWithCov/i, ulbWards: /^uLBWardforState(?!WithCov)/i,
};
const REQUIRED = ["districts", "subdistricts", "villages", "villageGp", "priWards", "ulbs", "ulbWards"];
if (!existsSync(IN)) { console.error(`Input folder not found: ${IN}`); process.exit(1); }
const files = readdirSync(IN).filter((f) => /\.xlsx?$/i.test(f)).sort((a, b) => a.length - b.length || a.localeCompare(b));
const src = {};
for (const [kind, re] of Object.entries(KINDS)) { const f = files.find((x) => re.test(x)); if (f) src[kind] = join(IN, f); }
const missing = REQUIRED.filter((k) => !src[k]);
if (missing.length) { console.error(`Missing LGD exports: ${missing.join(", ")}. Expected files named like ${missing.map((k) => KINDS[k].source.slice(1)).join(", ")}…`); process.exit(1); }

// ── Helpers ─────────────────────────────────────────────────────────────────
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function writeCsv(name, cols, list) {
  writeFileSync(join(OUT, name), [cols.join(","), ...list.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n");
  log(`wrote ${name} (${list.length.toLocaleString("en-IN")} rows)`);
}
const tally = () => new Map();
const bump = (m, k, v) => { if (!k || !v) return; const t = m.get(k) ?? new Map(); t.set(v, (t.get(v) ?? 0) + 1); m.set(k, t); };
const top = (t) => (t ? [...t.entries()].sort((a, b) => b[1] - a[1])[0][0] : "");
/** LGD sometimes title-cases acronyms in English ("Ntr"); prefer the local spelling when it is a short all-caps acronym. */
const displayName = (en, local) => (local && en.toLowerCase() === local.toLowerCase() && /^[A-Z.\s]{2,5}$/.test(local) ? local : en);
const isTelugu = (s) => /[\u0C00-\u0C7F]/.test(s);
const report = { generatedAt: new Date().toISOString(), state: STATE, sources: Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.split(/[\\/]/).pop()])), counts: {}, issues: {} };
mkdirSync(OUT, { recursive: true });

// ── 1. Districts ────────────────────────────────────────────────────────────
const districts = [];
for await (const r of records(src.districts)) {
  need(r, ["district code", "district name"], "districts");
  if (!/^\d+$/.test(r["district code"])) continue;
  districts.push({ lgdCode: r["district code"], name: displayName(r["district name"], r["district name#2"]), nameLocal: isTelugu(r["district name#2"]) ? r["district name#2"] : "", census2011: /^\d{3}$/.test(r["census 2011 code"]) && r["census 2011 code"] !== "000" ? r["census 2011 code"] : "" });
}
const districtCodes = new Set(districts.map((d) => d.lgdCode));
log(`districts: ${districts.length}`);

// ── 2. Sub-districts (revenue mandals) ──────────────────────────────────────
const subdistricts = [];
for await (const r of records(src.subdistricts)) {
  need(r, ["district code", "subdistrict code", "subdistrict name"], "subdistricts");
  if (!/^\d+$/.test(r["subdistrict code"])) continue;
  subdistricts.push({ lgdCode: r["subdistrict code"], name: r["subdistrict name"], nameLocal: isTelugu(r["subdistrict name#2"] ?? "") ? r["subdistrict name#2"] : "", districtCode: r["district code"] });
}
const subdistrictByCode = new Map(subdistricts.map((s) => [s.lgdCode, s]));
log(`subdistricts: ${subdistricts.length}`);

// ── 3. Villages, their Gram Panchayat and block ─────────────────────────────
const villages = new Map();
for await (const r of records(src.villages)) {
  need(r, ["district code", "sub-district code", "village code", "village name"], "villages");
  if (!/^\d+$/.test(r["village code"])) continue;
  villages.set(r["village code"], { lgdCode: r["village code"], name: r["village name"], nameLocal: isTelugu(r["village name#2"] ?? "") ? r["village name#2"] : "", districtCode: r["district code"], subDistrictCode: r["sub-district code"], status: r["village status"] ?? "", census2011: r["census 2011 code"] ?? "", gpCode: "", blockCode: "" });
}
log(`villages: ${villages.size}`);
const gpDistrict = tally(), gpSubdistrict = tally(), gpVillages = new Map();
let mappingRows = 0, mappingUnknownVillage = 0;
for await (const r of records(src.villageGp)) {
  need(r, ["village code", "local body code", "district code", "subdistrict code"], "village→GP mapping");
  if (!/^\d+$/.test(r["village code"]) || !/^\d+$/.test(r["local body code"])) continue;
  mappingRows++;
  const v = villages.get(r["village code"]);
  if (v) v.gpCode = r["local body code"]; else mappingUnknownVillage++;
  bump(gpDistrict, r["local body code"], r["district code"]);
  bump(gpSubdistrict, r["local body code"], r["subdistrict code"]);
  gpVillages.set(r["local body code"], (gpVillages.get(r["local body code"]) ?? 0) + 1);
}
log(`village→GP mapping rows: ${mappingRows}`);
if (src.blockVillages) {
  for await (const r of records(src.blockVillages)) { const v = villages.get(r["village code"]); if (v && /^\d+$/.test(r["block code"])) v.blockCode = r["block code"]; }
  log("village→block coverage applied");
}

// ── 4. Gram Panchayats and their wards (from the PRI wards export) ──────────
// Zilla Parishads are named after pre-2022 districts; used only when a GP has no mapped villages.
const ZP_TO_DISTRICT = { anantapur: "502", ananthapuramu: "502", chittoor: "503", "east godavari": "505", guntur: "506", krishna: "510", kurnool: "511", prakasam: "517", srikakulam: "519", nellore: "515", "sri potti sriramulu nellore": "515", visakhapatnam: "520", vizianagaram: "521", "west godavari": "523", kadapa: "504", "y.s.r.": "504", "y.s.r. kadapa": "504", ysr: "504" };
const gps = new Map(), wards = [], priTypes = {}, wardKeys = new Set();
const seenWardNumbers = new Map();
let wardNumberFixes = 0, duplicateWardCodes = 0;
function addWard(kind, lbCode, r, numberRaw, nameEn, nameLocal) {
  const code = r["ward code"];
  if (!/^\d+$/.test(code)) return;
  const key = `${kind}:${code}`;
  if (wardKeys.has(key)) { duplicateWardCodes++; return; }
  wardKeys.add(key);
  const used = seenWardNumbers.get(lbCode) ?? new Set();
  let n = parseInt(numberRaw, 10);
  if (!Number.isFinite(n) || n <= 0) n = parseInt((nameEn.match(/(\d+)\s*$/) ?? [])[1] ?? "", 10);
  if (!Number.isFinite(n) || n <= 0 || used.has(n)) { wardNumberFixes++; n = Math.max(0, ...used) + 1; }
  used.add(n); seenWardNumbers.set(lbCode, used);
  wards.push({ lgdCode: code, kind, localBodyCode: lbCode, number: n, name: nameEn || `Ward ${n}`, nameLocal: isTelugu(nameLocal) ? nameLocal : "" });
}
for await (const r of records(src.priWards)) {
  need(r, ["local body code", "local body name", "local body type", "ward code", "ward number"], "PRI wards");
  const type = r["local body type"];
  priTypes[type] = (priTypes[type] ?? 0) + 1;
  if (!/gram|grama/i.test(type)) continue; // keep village-level (Gram Panchayat) wards only
  const lb = r["local body code"];
  if (!gps.has(lb)) gps.set(lb, { lgdCode: lb, kind: "GP", type: "GRAM_PANCHAYAT", name: r["local body name"], zp: r["district level parent name"] ?? "", block: r["intermediate level parent name"] ?? "" });
  addWard("GP", lb, r, r["ward number"], r["ward name"] ?? "", r["ward name#2"] ?? "");
}
log(`PRI rows by type: ${JSON.stringify(priTypes)}`);
let gpDistrictFallback = 0, gpUnplaced = 0;
const localBodies = [];
for (const g of gps.values()) {
  let districtCode = top(gpDistrict.get(g.lgdCode));
  if (!districtCode) { districtCode = ZP_TO_DISTRICT[g.zp.toLowerCase()] ?? ""; if (districtCode) gpDistrictFallback++; }
  if (!districtCodes.has(districtCode)) { gpUnplaced++; continue; }
  const subDistrictCode = top(gpSubdistrict.get(g.lgdCode));
  localBodies.push({ lgdCode: g.lgdCode, kind: "GP", type: "GRAM_PANCHAYAT", name: g.name, districtCode, subDistrictCode: subdistrictByCode.has(subDistrictCode) ? subDistrictCode : "", block: g.block, villageCount: gpVillages.get(g.lgdCode) ?? 0 });
}
log(`gram panchayats: ${localBodies.length} (${gpDistrictFallback} placed via Zilla Parishad name, ${gpUnplaced} unplaced)`);

// ── 5. Urban local bodies and wards ─────────────────────────────────────────
const ULB_TYPE = (name) => /corporation/i.test(name) ? "MUNICIPAL_CORPORATION" : /nagar|nagara panchayat/i.test(name) ? "NAGAR_PANCHAYAT" : "MUNICIPALITY";
const ulbDistrict = tally(), ulbSubdistrict = tally();
if (src.ulbWardsCov) for await (const r of records(src.ulbWardsCov)) { bump(ulbDistrict, r["local body code"], r["district code"]); bump(ulbSubdistrict, r["local body code"], r["subdistrict code"]); }
const ulbTypes = {};
let ulbUnplaced = 0;
const ulbCodes = new Set();
for await (const r of records(src.ulbs)) {
  need(r, ["localbody code", "local body name", "localbody type name"], "ULBs");
  if (!/^\d+$/.test(r["localbody code"])) continue;
  ulbTypes[r["localbody type name"]] = (ulbTypes[r["localbody type name"]] ?? 0) + 1;
  const districtCode = top(ulbDistrict.get(r["localbody code"]));
  if (!districtCodes.has(districtCode)) { ulbUnplaced++; continue; }
  const sd = top(ulbSubdistrict.get(r["localbody code"]));
  ulbCodes.add(r["localbody code"]);
  localBodies.push({ lgdCode: r["localbody code"], kind: "ULB", type: ULB_TYPE(r["localbody type name"]), name: r["local body name"], districtCode, subDistrictCode: subdistrictByCode.has(sd) ? sd : "", block: "", villageCount: 0 });
}
log(`urban local bodies: ${ulbCodes.size} (${ulbUnplaced} without district coverage) types=${JSON.stringify(ulbTypes)}`);
for await (const r of records(src.ulbWards)) {
  need(r, ["local body code", "ward code", "ward number", "ward name"], "ULB wards");
  if (ulbCodes.has(r["local body code"])) addWard("ULB", r["local body code"], r, r["ward number"], r["ward name"], "");
}

// ── 6. Data quality and output ──────────────────────────────────────────────
const lbWithWards = new Set(wards.map((w) => `${w.kind}:${w.localBodyCode}`));
const lbWithoutWards = localBodies.filter((l) => !lbWithWards.has(`${l.kind}:${l.lgdCode}`));
const placedGp = new Set(localBodies.filter((l) => l.kind === "GP").map((l) => l.lgdCode));
const wardsOut = wards.filter((w) => (w.kind === "GP" ? placedGp.has(w.localBodyCode) : ulbCodes.has(w.localBodyCode)));
const villageList = [...villages.values()];
const unmappedVillages = villageList.filter((v) => !v.gpCode);
const perDistrict = Object.fromEntries(districts.map((d) => [d.name, { gramPanchayats: 0, urbanLocalBodies: 0, wards: 0, villages: 0 }]));
const dName = new Map(districts.map((d) => [d.lgdCode, d.name]));
const lbDistrict = new Map(localBodies.map((l) => [`${l.kind}:${l.lgdCode}`, l.districtCode]));
for (const l of localBodies) perDistrict[dName.get(l.districtCode)][l.kind === "GP" ? "gramPanchayats" : "urbanLocalBodies"]++;
for (const w of wardsOut) perDistrict[dName.get(lbDistrict.get(`${w.kind}:${w.localBodyCode}`))].wards++;
for (const v of villageList) if (dName.has(v.districtCode)) perDistrict[dName.get(v.districtCode)].villages++;

report.counts = { districts: districts.length, subdistricts: subdistricts.length, villages: villageList.length, gramPanchayats: placedGp.size, urbanLocalBodies: ulbCodes.size, wards: wardsOut.length, gpWards: wardsOut.filter((w) => w.kind === "GP").length, ulbWards: wardsOut.filter((w) => w.kind === "ULB").length };
report.issues = {
  villagesWithoutGramPanchayat: unmappedVillages.length,
  mappingRowsForUnknownVillages: mappingUnknownVillage,
  gramPanchayatsPlacedByZillaParishadName: gpDistrictFallback,
  gramPanchayatsWithoutDistrict: gpUnplaced,
  urbanLocalBodiesWithoutDistrictCoverage: ulbUnplaced,
  localBodiesWithoutWards: lbWithoutWards.length,
  duplicateWardCodesSkipped: duplicateWardCodes,
  wardNumbersRenumbered: wardNumberFixes,
  priRowsByType: priTypes,
};
report.perDistrict = perDistrict;

writeCsv("districts.csv", ["lgdCode", "name", "nameLocal", "census2011"], districts);
writeCsv("subdistricts.csv", ["lgdCode", "name", "nameLocal", "districtCode"], subdistricts);
writeCsv("local-bodies.csv", ["lgdCode", "kind", "type", "name", "districtCode", "subDistrictCode", "block", "villageCount"], localBodies);
writeCsv("wards.csv", ["lgdCode", "kind", "localBodyCode", "number", "name", "nameLocal"], wardsOut);
writeCsv("villages.csv", ["lgdCode", "name", "nameLocal", "districtCode", "subDistrictCode", "gpCode", "blockCode", "status", "census2011"], villageList);
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
log(`done → ${OUT}`);
console.log(JSON.stringify({ counts: report.counts, issues: { ...report.issues, priRowsByType: undefined } }, null, 2));
