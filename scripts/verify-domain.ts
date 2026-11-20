// Dependency-free checks of the core business rules. Runs on plain Node ≥22.6:
//   node --experimental-strip-types scripts/verify-domain.ts
// The full suites live in tests/unit (Vitest); this script exists so the rules
// can be verified even before `npm install`.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseCsv } from "../src/lib/domain/csv-parse.ts";
import { bbox, makeProjector, matchDistrict, simplifyRing, toSvgPath, countPoints, simplifyGeometry } from "../src/lib/domain/geo.ts";
import { buildAiPrompt, extractJson, parseAiInsights } from "../src/lib/domain/ai.ts";
import { dissolve, pointInGeometry, villageCensusCode } from "../src/lib/domain/geo.ts";
import { readDbf, readShp } from "../src/lib/domain/shapefile.ts";
import { matchMandal, type SubDistrict } from "../src/lib/domain/mandal-match.ts";
import { DEMO_ACCOUNTS } from "../prisma/demo-accounts.ts";
import { test } from "node:test";
import { checkTransition, allowedTransitions, computeDueAt, isOverdue } from "../src/lib/domain/status.ts";
import { computeScore, normalize, percentChange, pointChange, scoreBand, resolutionRate, aggregateScores } from "../src/lib/domain/scoring.ts";
import { evaluateRules } from "../src/lib/domain/insights.ts";
import { toCsv, csvCell } from "../src/lib/domain/csv.ts";
import { detectMime, validateUpload, sanitizeFileName } from "../src/lib/domain/files.ts";
import { makeReference, REFERENCE_PATTERN } from "../src/lib/domain/reference.ts";
import { parseMonthKey, monthWindow, lastNMonths, monthKey } from "../src/lib/domain/period.ts";

test("lifecycle: happy path is allowed for admins", () => {
  assert.deepEqual(checkTransition("SUBMITTED", "UNDER_REVIEW", "ADMIN"), { ok: true });
  assert.deepEqual(checkTransition("UNDER_REVIEW", "ASSIGNED", "ADMIN", { hasAssignment: true }), { ok: true });
  assert.deepEqual(checkTransition("ASSIGNED", "IN_PROGRESS", "ADMIN"), { ok: true });
  assert.deepEqual(checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "Pipe joint replaced", evidenceCount: 1 }), { ok: true });
  assert.deepEqual(checkTransition("RESOLVED", "CLOSED", "CITIZEN"), { ok: true });
});
test("lifecycle: skipping steps and citizen escalation are rejected", () => {
  assert.equal((checkTransition("SUBMITTED", "RESOLVED", "ADMIN") as any).code, "INVALID_TRANSITION");
  assert.equal((checkTransition("SUBMITTED", "UNDER_REVIEW", "CITIZEN") as any).code, "NOT_PERMITTED");
  assert.equal((checkTransition("REJECTED", "UNDER_REVIEW", "ADMIN") as any).code, "INVALID_TRANSITION");
});
test("lifecycle: requirements enforced", () => {
  assert.equal((checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "Fixed the pipe", evidenceCount: 0 }) as any).code, "MISSING_REQUIREMENT");
  assert.equal((checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "ok", evidenceCount: 2 }) as any).code, "MISSING_REQUIREMENT");
  assert.equal((checkTransition("SUBMITTED", "REJECTED", "ADMIN", { reason: "" }) as any).code, "MISSING_REQUIREMENT");
  assert.equal((checkTransition("SUBMITTED", "DUPLICATE", "ADMIN", { reason: "same pothole" }) as any).code, "MISSING_REQUIREMENT");
  assert.equal((checkTransition("UNDER_REVIEW", "ASSIGNED", "ADMIN", { hasAssignment: false }) as any).code, "MISSING_REQUIREMENT");
});
test("lifecycle: reopen window", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  assert.deepEqual(checkTransition("CLOSED", "REOPEN_REQUESTED", "CITIZEN", { reason: "Leak is back again", closedAt: new Date("2026-11-01T00:00:00Z"), now }), { ok: true });
  assert.equal((checkTransition("CLOSED", "REOPEN_REQUESTED", "CITIZEN", { reason: "Leak is back again", closedAt: new Date("2026-09-01T00:00:00Z"), now }) as any).code, "WINDOW_EXPIRED");
  assert.deepEqual(allowedTransitions("REOPEN_REQUESTED", "ADMIN").sort(), ["CLOSED", "REOPENED"]);
});
test("SLA", () => {
  const c = new Date("2026-11-01T00:00:00Z");
  assert.equal(computeDueAt(c, 72, "URGENT").toISOString(), "2026-11-02T12:00:00.000Z");
  assert.equal(isOverdue("IN_PROGRESS", new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z")), true);
  assert.equal(isOverdue("RESOLVED", new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z")), false);
});
const defs = [
  { key: "water", weight: 25, target: 100, worst: 0, higherIsBetter: true },
  { key: "roads", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "drainage", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "sanitation", weight: 20, target: 100, worst: 0, higherIsBetter: true },
  { key: "health", weight: 15, target: 100, worst: 0, higherIsBetter: true },
];
test("scoring: weighted mean and contributions", () => {
  const r = computeScore(defs, { water: 90, roads: 75, drainage: 80, sanitation: 85, health: 70 });
  // (90*25+75*20+80*20+85*20+70*15)/100 = 81.0
  assert.equal(r.score, 81);
  assert.equal(r.status, "ok");
  const pts = r.contributions.reduce((s, c) => s + (c.points ?? 0), 0);
  assert.ok(Math.abs(pts - 81) < 0.3);
});
test("scoring: missing data re-weights, then reports insufficient data", () => {
  const r = computeScore(defs, { water: 90, roads: 70, drainage: 80 }); // 65% coverage
  assert.equal(r.status, "ok");
  assert.equal(r.score, 80.8); // (90·25 + 70·20 + 80·20) / 65 = 80.77
});
test("scoring: lower-is-better and edge cases", () => {
  assert.equal(normalize(5, { key: "x", weight: 1, target: 0, worst: 20, higherIsBetter: false }), 75);
  assert.equal(normalize(150, defs[0]), 100);
  assert.equal(computeScore(defs, { water: 90 }).score, null);
  assert.equal(computeScore(defs, {}).status, "insufficient_data");
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(5, 0), null);
  assert.equal(pointChange(82.5, 79.3), 3.2);
  assert.equal(scoreBand(92.1), "Excellent");
  assert.equal(scoreBand(85.7), "Good");
  assert.equal(scoreBand(76.4), "Needs Attention");
  assert.equal(scoreBand(68.9), "Critical");
  assert.equal(scoreBand(null), "Insufficient data");
  assert.equal(resolutionRate(3421, 3892), 87.9);
  assert.equal(resolutionRate(1, 0), null);
  assert.equal(aggregateScores([80, null, 90]), 85);
});
test("insights: rules fire deterministically with evidence and links", () => {
  const base = { wardLabel: "Ward 12, Machilipatnam", newPrev30: 2, open: 3, overdue: 0, last90: 3, newLast30: 0 };
  const res = evaluateRules([
    { ...base, wardId: "w1", categoryId: "c-water", categorySlug: "water", categoryName: "Water", newLast30: 6 },
    { ...base, wardId: "w1", categoryId: "c-roads", categorySlug: "roads", categoryName: "Roads", overdue: 7, open: 9 },
    { ...base, wardId: "w1", categoryId: "c-drain", categorySlug: "drainage", categoryName: "Drainage", last90: 7 },
    { ...base, wardId: "w2", categoryId: "c-garb", categorySlug: "garbage", categoryName: "Garbage", open: 5, overdue: 3 },
    { ...base, wardId: "w3", categoryId: "c-water", categorySlug: "water", categoryName: "Water", newLast30: 1 },
  ]);
  assert.deepEqual(res.map((r) => r.ruleKey), ["ROAD_REPAIR_PRIORITY", "WATER_SUPPLY_RISK", "DRAINAGE_REVIEW", "SERVICE_BACKLOG"]);
  assert.equal(res[1].severity, "HIGH");
  assert.match(res[0].link, /overdue=1/);
  assert.deepEqual(evaluateRules(res.length ? [] : []), []);
});
test("csv: escaping and formula neutralisation", () => {
  assert.equal(csvCell('He said "hi", ok'), '"He said ""hi"", ok"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  const out = toCsv([{ a: 1, b: "x\ny" }], [{ header: "A", value: (r) => r.a }, { header: "B", value: (r) => r.b }]);
  assert.equal(out, '\uFEFFA,B\r\n1,"x\ny"\r\n');
});
test("files: signature detection beats extension", () => {
  assert.equal(detectMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectMime(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null); // "<svg"
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  assert.equal(validateUpload(pdf, "COMPLAINT", 1000).ok, false);
  assert.equal(validateUpload(pdf, "RESOLUTION", 1000).ok, true);
  assert.equal(validateUpload(new Uint8Array(2000).fill(0xff), "COMPLAINT", 1000).ok, false);
  assert.equal(sanitizeFileName("../../etc/<pass wd>.jpg"), "_pass wd_.jpg");
});
test("files: video detection and per-type limits", () => {
  const box = (brand: string) => new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0))]);
  assert.equal(detectMime(box("isom")), "video/mp4");
  assert.equal(detectMime(box("qt  ")), "video/quicktime");
  assert.equal(detectMime(box("heic")), null); // HEIC photos are not video
  assert.equal(detectMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1])), "video/webm");
  const big = new Uint8Array(3000); big.set(box("mp42"));
  assert.equal(validateUpload(big, "COMPLAINT", 1000, 5000).ok, true);   // video uses the video limit
  assert.equal(validateUpload(big, "COMPLAINT", 1000, 2000).ok, false);
  assert.equal(validateUpload(big, "PROJECT_PHOTO", 1000, 5000).ok, false); // project photos are images only
});
test("reference and periods", () => {
  const ref = makeReference(new Date("2026-11-15T00:00:00Z"), new Uint8Array([1, 2, 3, 250, 31, 64]));
  assert.match(ref, REFERENCE_PATTERN);
  assert.ok(ref.startsWith("SWI-2611-"));
  const w = monthWindow(parseMonthKey("2026-01"));
  assert.equal(monthKey(w.prevStart), "2025-12");
  assert.equal(parseMonthKey("2026-13", new Date("2026-11-15T00:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.deepEqual(lastNMonths(new Date("2026-11-15T00:00:00Z"), 3).map(monthKey), ["2026-09", "2026-10", "2026-11"]);
});

test("csv: quotes, commas, newlines and BOM", () => {
  const rows = parseCsv('\uFEFFa,b\n1,"x, ""y"""\n2,"line\nbreak"\n');
  assert.deepEqual(rows, [{ a: "1", b: 'x, "y"' }, { a: "2", b: "line\nbreak" }]);
});

test("LGD data: converted Andhra Pradesh files are complete and consistent", { skip: !existsSync("data/lgd/andhra-pradesh/wards.csv") }, () => {
  const dir = "data/lgd/andhra-pradesh";
  const read = (f: string) => parseCsv(readFileSync(`${dir}/${f}`, "utf8"));
  const districts = read("districts.csv"), subs = read("subdistricts.csv"), bodies = read("local-bodies.csv"), wards = read("wards.csv"), villages = read("villages.csv");
  const report = JSON.parse(readFileSync(`${dir}/report.json`, "utf8"));
  assert.equal(districts.length, report.counts.districts);
  assert.equal(wards.length, report.counts.wards);
  assert.equal(villages.length, report.counts.villages);
  const dc = new Set(districts.map((d) => d.lgdCode));
  assert.ok(bodies.every((b) => dc.has(b.districtCode)), "every local body has a valid district");
  assert.ok(subs.every((s) => dc.has(s.districtCode)), "every mandal has a valid district");
  const lb = new Set(bodies.map((b) => b.lgdCode));
  assert.equal(lb.size, bodies.length, "local body LGD codes are unique");
  assert.ok(wards.every((w) => lb.has(w.localBodyCode)), "every ward belongs to a known local body");
  assert.equal(new Set(wards.map((w) => w.lgdCode)).size, wards.length, "ward LGD codes are unique");
  const keys = new Set(wards.map((w) => `${w.localBodyCode}:${w.number}`));
  assert.equal(keys.size, wards.length, "ward numbers are unique within each local body");
  assert.ok(villages.filter((v) => v.gpCode).every((v) => lb.has(v.gpCode)), "mapped villages point to real Gram Panchayats");
  const hq = JSON.parse(readFileSync("data/geo/district-hq.json", "utf8"));
  assert.ok(districts.every((d) => hq[d.lgdCode]?.lat > 12 && hq[d.lgdCode]?.lat < 20), "every district has a map marker inside Andhra Pradesh");
});

test("geo: projection, simplification and LGD name matching", () => {
  const sq = { type: "Polygon" as const, coordinates: [[[80, 16], [80.5, 16], [80.5, 16.5], [80.25, 16.5001], [80, 16.5], [80, 16]] as [number, number][]] };
  const f = [{ type: "Feature" as const, properties: {}, geometry: sq }];
  assert.deepEqual(bbox(f), [80, 16, 80.5, 16.5001]); // includes the near-collinear vertex
  const proj = makeProjector(bbox(f), 100, 100, 0);
  const [x0, y0] = proj(80, 16.5), [x1, y1] = proj(80.5, 16);
  assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 100.001 && y1 <= 100.001, "projected into the viewport");
  assert.ok(toSvgPath(sq, proj).startsWith("M") && toSvgPath(sq, proj).endsWith("Z"));
  assert.equal(simplifyRing(sq.coordinates[0], 0.01).length, 5, "near-collinear point removed");
  assert.ok(countPoints(simplifyGeometry(sq, 0.01)) < countPoints(sq));
  const lgd = [{ lgdCode: "504", name: "Y.S.R. Kadapa" }, { lgdCode: "515", name: "Sri Potti Sriramulu Nellore" }, { lgdCode: "749", name: "NTR" }, { lgdCode: "502", name: "Ananthapuramu" }];
  assert.equal(matchDistrict("Cuddapah", lgd), "504");
  assert.equal(matchDistrict("NELLORE DISTRICT", lgd), "515");
  assert.equal(matchDistrict("N.T.R", lgd), "749");
  assert.equal(matchDistrict("Anantapur", lgd), "502");
  assert.equal(matchDistrict("Hyderabad", lgd), null);
});

test("ai: prompt carries only aggregates; output is validated against known areas", () => {
  const ctx = { scope: "Krishna district", generatedFor: "November 2026", structure: { mandals: 26, gramPanchayats: 491, urbanBodies: 5, wards: 10000, villages: 500, villagesWithoutPanchayat: 3 },
    areas: [{ name: "Machilipatnam Municipal Corporation", kind: "urban" as const, wards: 50, complaints30: 120, complaintsPrev30: 70, open: 40, overdue: 12, resolutionRate: 61, score: 79.5, topCategories: ["Water (40)"] }],
    categories: [{ name: "Water", last30: 50, prev30: 20, open: 18, overdue: 6 }], indicators: [{ name: "Drinking Water", score: 88 }], ruleAlerts: [], projects: { active: 3, delayed: 1, completed: 4 } };
  const prompt = buildAiPrompt(ctx);
  assert.ok(prompt.includes("Machilipatnam Municipal Corporation") && !/@|\+91|reporter/i.test(prompt), "no personal data in prompt");
  assert.deepEqual(extractJson('Sure!\n```json\n{"insights":[{"a":"}"}]}\n```'), { insights: [{ a: "}" }] });
  const out = JSON.stringify({ insights: [
    { title: "Water complaints up 150%", area: "machilipatnam municipal corporation", category: "water", severity: "high", evidence: "50 vs 20 in 30 days", recommendation: "Inspect pipelines", horizon: "30 days", confidence: "high" },
    { title: "Invented place", area: "Atlantis", severity: "HIGH", evidence: "x", recommendation: "y" },
    { title: "", area: "Krishna district", evidence: "x", recommendation: "y" },
  ] });
  const r = parseAiInsights(out, [ctx.scope, ...ctx.areas.map((a) => a.name)], ctx.categories.map((c) => c.name));
  assert.equal(r.insights.length, 1);
  assert.equal(r.dropped, 2, "unknown area and empty title dropped");
  assert.equal(r.insights[0].area, "Machilipatnam Municipal Corporation", "area normalised to the canonical name");
  assert.equal(r.insights[0].severity, "HIGH");
  assert.equal(r.insights[0].category, "Water");
  assert.ok(parseAiInsights("no json here", ["x"]).error);
});

test("geo: dissolving neighbours removes the shared border", () => {
  const a = { type: "Polygon" as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] as [number, number][][] };
  const b = { type: "Polygon" as const, coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] as [number, number][][] };
  const g = dissolve([a, b]);
  assert.equal(g?.type, "Polygon", "one shape, not two");
  assert.ok(pointInGeometry([0.5, 0.5], g) && pointInGeometry([1.5, 0.5], g) && !pointInGeometry([2.5, 0.5], g));
  const far = { type: "Polygon" as const, coordinates: [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]] as [number, number][][] };
  assert.equal(dissolve([a, far])?.type, "MultiPolygon", "separate shapes stay separate");
});

test("shapefile: reads polygons (clockwise outer ring) and dBase attributes", () => {
  // Build a one-record polygon shapefile and dBase file in memory.
  const ring = [[80, 16], [80, 17], [81, 17], [81, 16], [80, 16]]; // clockwise = outer
  const content = 44 + 4 + ring.length * 16;
  const shp = new DataView(new ArrayBuffer(100 + 8 + content));
  shp.setInt32(0, 9994, false); shp.setInt32(24, (100 + 8 + content) / 2, false); shp.setInt32(28, 1000, true); shp.setInt32(32, 5, true);
  shp.setInt32(100, 1, false); shp.setInt32(104, content / 2, false);
  const c = 108; shp.setInt32(c, 5, true); shp.setInt32(c + 36, 1, true); shp.setInt32(c + 40, ring.length, true); shp.setInt32(c + 44, 0, true);
  ring.forEach(([x, y], i) => { shp.setFloat64(c + 48 + i * 16, x, true); shp.setFloat64(c + 56 + i * 16, y, true); });
  const geoms = readShp(new Uint8Array(shp.buffer));
  assert.equal(geoms.length, 1);
  assert.equal(geoms[0]?.type, "Polygon");
  assert.ok(pointInGeometry([80.5, 16.5], geoms[0]));
  const dbf = new Uint8Array(32 + 32 + 1 + 1 + 20);
  const dv = new DataView(dbf.buffer);
  dbf[0] = 3; dv.setUint32(4, 1, true); dv.setUint16(8, 65, true); dv.setUint16(10, 21, true);
  dbf.set(new TextEncoder().encode("ST_NM"), 32); dbf[32 + 11] = 67; dbf[32 + 16] = 20; dbf[64] = 0x0d;
  dbf[65] = 0x20; dbf.set(new TextEncoder().encode("Andhra Pradesh".padEnd(20)), 66);
  assert.deepEqual(readDbf(dbf), [{ ST_NM: "Andhra Pradesh" }]);
});

test("mandal names: transliteration, abbreviations, renames, split cities, duplicates", () => {
  const subs: SubDistrict[] = [
    ["1", "Atlapragada Konduru", "749"], ["2", "Vijayawada Central", "749"], ["3", "Vijayawada East", "749"], ["4", "Vijayawada North", "749"], ["5", "Vijayawada West", "749"],
    ["6", "Rajamahendravaram Rural", "505"], ["7", "Rajamahendravaram Urban", "505"], ["8", "Laxminarasupeta", "519"], ["9", "Rompicherla", "503"], ["10", "Rompicharla", "751"],
    ["11", "Kumara Venkata Bhupala Puram", "752"], ["12", "J.Pangulur", "517"], ["13", "Kurnool Rural", "511"], ["14", "Kurnool Urban", "511"], ["15", "Gudur", "515"], ["16", "Gudur", "511"], ["17", "Nuzividu", "748"],
  ].map(([lgdCode, name, districtCode]) => ({ lgdCode, name, districtCode }));
  const m = (raw: string, hint: string | null = null) => matchMandal(raw, subs, (c) => c.find((x) => x.districtCode === hint), hint).codes;
  assert.deepEqual(m("A.Konduru"), ["1"]);
  assert.deepEqual(m("Vijayawada (Urban)"), ["2", "3", "4", "5"]);
  assert.deepEqual(m("Rajahmundry (Rural)"), ["6"]);
  assert.deepEqual(m("Lakshminarsupeta"), ["8"]);
  assert.deepEqual(m("Rompicherla2", "751"), ["10"], "same name in another district: the shape's own district wins");
  assert.deepEqual(m("Rompicherla1", "503"), ["9"]);
  assert.deepEqual(m("K.V.B.Puram"), ["11"]);
  assert.deepEqual(m("Janakavarampanguluru"), ["12"]);
  assert.deepEqual(m("Kurnool"), ["13", "14"]);
  assert.deepEqual(m("Gudur2", "511"), ["16"]);
  assert.deepEqual(m("Nuzvid"), ["17"]);
  assert.deepEqual(m("Bhadrachalam"), []);
});

test("boundary layers: 28 districts, 175 constituencies, mandals linked to LGD", { skip: !existsSync("public/geo/andhra-pradesh-districts.geojson") }, () => {
  const load = (f: string) => JSON.parse(readFileSync(`public/geo/${f}`, "utf8")).features as Array<{ properties: Record<string, unknown> }>;
  const lgd = parseCsv(readFileSync("data/lgd/andhra-pradesh/districts.csv", "utf8"));
  const districts = load("andhra-pradesh-districts.geojson");
  assert.deepEqual(new Set(districts.map((f) => f.properties.lgdCode)), new Set(lgd.map((d) => d.lgdCode)), "one shape for each current LGD district");
  const acs = load("andhra-pradesh-assembly-constituencies.geojson");
  assert.equal(acs.length, 175);
  assert.deepEqual(acs.map((f) => f.properties.acNo), Array.from({ length: 175 }, (_, i) => i + 1));
  const mandals = load("andhra-pradesh-mandals.geojson");
  const subs = new Set(parseCsv(readFileSync("data/lgd/andhra-pradesh/subdistricts.csv", "utf8")).map((s) => s.lgdCode));
  const linked = mandals.filter((f) => (f.properties.lgdCodes as string[]).length > 0);
  assert.ok(linked.length / mandals.length > 0.99, `${linked.length}/${mandals.length} mandal shapes linked to LGD`);
  assert.ok(linked.every((f) => (f.properties.lgdCodes as string[]).every((c) => subs.has(c))), "only real LGD codes");
  assert.ok(mandals.every((f) => typeof f.properties.acNo === "number"), "every mandal is placed in a constituency");
});

test("demo accounts: valid credentials and every place exists in the LGD data", { skip: !existsSync("data/lgd/andhra-pradesh/local-bodies.csv") }, () => {
  const dir = "data/lgd/andhra-pradesh";
  const districts = parseCsv(readFileSync(`${dir}/districts.csv`, "utf8"));
  const bodies = parseCsv(readFileSync(`${dir}/local-bodies.csv`, "utf8"));
  const wardKeys = new Set(parseCsv(readFileSync(`${dir}/wards.csv`, "utf8")).map((w) => `${w.localBodyCode}:${w.number}`));
  const dCode = (name: string) => { const d = districts.find((x) => x.name === name); assert.ok(d, `district ${name}`); return d!.lgdCode; };
  const body = (r: { district: string; localBody: string; bodyType?: string }) => {
    const m = bodies.filter((b) => b.districtCode === dCode(r.district) && b.name === r.localBody && (!r.bodyType || b.type === r.bodyType));
    assert.equal(m.length, 1, `${r.localBody} (${r.district}) must match exactly one LGD local body, found ${m.length}`);
    return m[0].lgdCode;
  };
  assert.ok(DEMO_ACCOUNTS.length >= 20);
  assert.equal(new Set(DEMO_ACCOUNTS.map((a) => a.email)).size, DEMO_ACCOUNTS.length, "emails are unique");
  for (const a of DEMO_ACCOUNTS) {
    assert.match(a.email, /^[a-z0-9.]+@smartward\.test$/);
    assert.ok(a.password.length >= 10 && /[a-z]/.test(a.password) && /[A-Z]/.test(a.password) && /\d/.test(a.password) && /[^\w]/.test(a.password), `${a.email}: password policy`);
    if (a.home) assert.ok(wardKeys.has(`${body(a.home)}:${a.home.ward}`), `${a.email}: home ward exists`);
    for (const sc of a.scopes ?? []) {
      if (sc.type === "DISTRICT") dCode(sc.district);
      else if (sc.type === "LOCAL_BODY") body(sc);
      else assert.ok(wardKeys.has(`${body(sc)}:${sc.ward}`), `${a.email}: scoped ward exists`);
    }
    if (a.role === "CITIZEN") assert.ok(a.home && !a.scopes?.length, `${a.email}: citizens have a home ward and no admin scope`);
    if (a.role === "WARD_ADMIN") assert.ok(a.scopes?.length && a.scopes.every((x) => x.type !== "DISTRICT"), `${a.email}: ward admins manage local bodies or wards`);
    if (a.role === "DISTRICT_ADMIN") assert.ok(a.scopes?.length && a.scopes.every((x) => x.type === "DISTRICT"), `${a.email}: district scope`);
    if (a.role === "SUPER_ADMIN") assert.ok(!a.scopes?.length);
  }
});

test("villages: Census 2011 codes are read from common boundary-file properties", () => {
  assert.equal(villageCensusCode({ village_code_2011: "589123" }), "589123");
  assert.equal(villageCensusCode({ C_CODE11: "0589123" }), "589123", "leading zeros ignored");
  assert.equal(villageCensusCode({ pc11_village_id: 589123 }), "589123");
  assert.equal(villageCensusCode({ name: "x" }), null);
});
