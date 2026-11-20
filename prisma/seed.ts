/**
 * DEVELOPMENT-ONLY demo seed. Creates synthetic geography, accounts, complaints,
 * projects, indicator history, meetings and announcements, then computes scores
 * and insights from those records. Refuses to run in production.
 *
 *   npm run db:seed
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComplaintStatus, Prisma, Priority, Severity } from "@prisma/client";

process.env.SEEDING = "1"; // suppresses sign-up verification emails for demo accounts

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data with NODE_ENV=production.");
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1|postgres)(:|\/)/.test(dbUrl) && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error("DATABASE_URL does not point at a local database. Set ALLOW_DEMO_SEED=1 if you really want demo data there.");
  process.exit(1);
}

async function main() {
// Imports that read env must come after the guards above.
const { prisma } = await import("../src/lib/db");
const { auth } = await import("../src/lib/auth");
const { recomputeSnapshots } = await import("../src/lib/services/scores");
const { generateInsights } = await import("../src/lib/services/insights");
const { setSetting, DEFAULT_CONTENT } = await import("../src/lib/settings");
const { computeDueAt, severityToPriority } = await import("../src/lib/domain/status");
const { makeReference } = await import("../src/lib/domain/reference");
const { addMonths, monthStart } = await import("../src/lib/domain/period");

// ── Deterministic randomness ────────────────────────────────────────────────
let seed = 20261115;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const HOUR = 3_600_000, DAY = 24 * HOUR;
const NOW = new Date();

// ── Reset (development database only) ───────────────────────────────────────
console.log("Clearing existing data…");
await prisma.$transaction([
  prisma.notification.deleteMany(), prisma.aiReport.deleteMany(), prisma.auditLog.deleteMany(), prisma.reportExport.deleteMany(), prisma.insight.deleteMany(),
  prisma.scoreSnapshot.deleteMany(), prisma.indicatorReading.deleteMany(), prisma.indicatorDefinition.deleteMany(),
  prisma.attachment.deleteMany(), prisma.complaintFeedback.deleteMany(), prisma.complaintAssignment.deleteMany(),
  prisma.complaintComment.deleteMany(), prisma.complaintStatusHistory.deleteMany(), prisma.complaintSupport.deleteMany(), prisma.complaint.deleteMany(),
  prisma.milestone.deleteMany(), prisma.projectProgressLog.deleteMany(), prisma.project.deleteMany(),
  prisma.actionItem.deleteMany(), prisma.meetingParticipant.deleteMany(), prisma.meeting.deleteMany(),
  prisma.announcement.deleteMany(), prisma.partnerInquiry.deleteMany(), prisma.staffMember.deleteMany(),
  prisma.category.deleteMany(), prisma.department.deleteMany(), prisma.adminScope.deleteMany(),
  prisma.session.deleteMany(), prisma.account.deleteMany(), prisma.verification.deleteMany(), prisma.user.deleteMany(),
  prisma.village.deleteMany(), prisma.ward.deleteMany(), prisma.localBody.deleteMany(), prisma.subDistrict.deleteMany(), prisma.district.deleteMany(), prisma.state.deleteMany(),
  prisma.setting.deleteMany(), prisma.rateLimitBucket.deleteMany(),
]);

// ── Geography: the REAL Local Government Directory hierarchy (all 28 districts) ──
console.log("Importing the Local Government Directory hierarchy (this takes ~30–60 s)…");
const { importLgd } = await import("../scripts/lgd/import-lib");
await importLgd(prisma, { log: (m: string) => console.log("  " + m) });

// Synthetic demo activity is generated for a pilot area only (company roadmap Phase 3):
// every urban local body in Krishna and NTR districts, plus the Gram Panchayats of
// Movva (Kuchipudi), Ghantasala and Mopidevi mandals in Krishna district.
const PILOT_DISTRICTS = ["510", "749"]; // Krishna, NTR (LGD codes)
const PILOT_MANDALS = ["5032", "5033", "5036"]; // Movva, Ghantasala, Mopidevi (LGD sub-district codes)
// Beyond the pilot, three lighter tiers give every district, mandal and constituency map data:
//   city   – every municipal corporation statewide, and the largest urban body of districts without one
//   sample – wards 1–2 of one Gram Panchayat in every other mandal
type Tier = "pilot" | "city" | "sample";
type WardInfo = { id: string; number: number; district: string; body: string; kind: "GP" | "ULB"; tier: Tier; quality: number; createdAt: Date; lat: number; lng: number };
const BODY_SELECT = { id: true, name: true, type: true, districtId: true, subDistrictId: true, district: { select: { name: true, latitude: true, longitude: true } }, wards: { where: { isActive: true }, select: { id: true, number: true }, orderBy: { number: "asc" as const } } } as const;
const pilotBodies = await prisma.localBody.findMany({
  where: { OR: [{ type: { not: "GRAM_PANCHAYAT" }, district: { lgdCode: { in: PILOT_DISTRICTS } } }, { type: "GRAM_PANCHAYAT", subDistrict: { lgdCode: { in: PILOT_MANDALS } } }] },
  select: BODY_SELECT, orderBy: { name: "asc" },
});
const pilotIds = new Set(pilotBodies.map((b) => b.id));
const urbanBodies = await prisma.localBody.findMany({ where: { type: { not: "GRAM_PANCHAYAT" }, isActive: true }, select: BODY_SELECT, orderBy: { name: "asc" } });
const mcDistricts = new Set(urbanBodies.filter((u) => u.type === "MUNICIPAL_CORPORATION").map((u) => u.districtId));
const largestUrban = new Map<string, (typeof urbanBodies)[number]>();
for (const u of urbanBodies) if (!mcDistricts.has(u.districtId) && (largestUrban.get(u.districtId)?.wards.length ?? -1) < u.wards.length) largestUrban.set(u.districtId, u);
const cityBodies = [...urbanBodies.filter((u) => u.type === "MUNICIPAL_CORPORATION"), ...largestUrban.values()].filter((u) => !pilotIds.has(u.id));
const ruralCandidates = await prisma.localBody.findMany({
  where: { type: "GRAM_PANCHAYAT", isActive: true, subDistrictId: { not: null }, NOT: { subDistrict: { lgdCode: { in: PILOT_MANDALS } } } },
  select: { ...BODY_SELECT, wards: { where: { isActive: true, number: { lte: 2 } }, select: { id: true, number: true }, orderBy: { number: "asc" as const } } },
  orderBy: [{ subDistrictId: "asc" }, { name: "asc" }],
});
const sampleBodies: typeof ruralCandidates = [];
const seenMandal = new Set<string>();
for (const g of ruralCandidates) if (g.wards.length && !seenMandal.has(g.subDistrictId!)) { seenMandal.add(g.subDistrictId!); sampleBodies.push(g); }

const wards: WardInfo[] = [];
const bodyIds: Record<string, string> = {};
for (const [tier, list] of [["pilot", pilotBodies], ["city", cityBodies], ["sample", sampleBodies]] as const) for (const b of list) {
  bodyIds[b.name] ??= b.id;
  const urban = b.type !== "GRAM_PANCHAYAT";
  const base = urban ? (tier === "pilot" ? 80 : 77) + between(-4, 6) : 72 + between(-7, 6);
  for (const w of b.wards) {
    // Machilipatnam ward 4 is the "critical" example and ward 1 the "excellent" one, as in the reference design.
    const quality = b.name.startsWith("Machilipatnam") && w.number === 4 ? 63 : b.name.startsWith("Machilipatnam") && w.number === 1 ? 88 : base + between(-6, 6);
    wards.push({ id: w.id, number: w.number, district: b.district.name, body: b.name, kind: urban ? "ULB" : "GP", tier, quality,
      createdAt: new Date(NOW.getTime() - 760 * DAY), lat: (b.district.latitude ?? 16.2) + between(-0.05, 0.05), lng: (b.district.longitude ?? 80.9) + between(-0.05, 0.05) });
  }
}
const districtIds: Record<string, string> = Object.fromEntries((await prisma.district.findMany({ where: { lgdCode: { in: PILOT_DISTRICTS } }, select: { id: true, name: true } })).map((d) => [d.name, d.id]));
console.log(`  pilot area: ${pilotBodies.length} local bodies, ${wards.filter((w) => w.tier === "pilot").length} wards; city tier: ${cityBodies.length} urban bodies; sample tier: ${sampleBodies.length} Gram Panchayats (one per mandal); ${wards.length} wards with demo activity in total`);
const wardOf = (body: string, n: number) => { const w = wards.find((x) => x.tier === "pilot" && x.body.startsWith(body) && x.number === n) ?? wards.find((x) => x.body.startsWith(body) && x.number === n); if (!w) throw new Error(`Pilot ward not found: ${body} ${n}`); return w; };

// ── Organisation ────────────────────────────────────────────────────────────
console.log("Creating departments, categories and staff…");
const deptData = [
  ["Water Supply Department", "WATER"], ["Roads & Buildings Department", "RNB"], ["Public Health & Sanitation", "PHS"],
  ["Electrical Department", "ELEC"], ["Drainage Division", "DRN"], ["Health Department", "HLTH"], ["Town Planning", "TP"],
  ["Education Department", "EDU"], ["Rural Development & Employment", "RDE"], ["Agriculture Department", "AGRI"], ["Environment & Pollution Control", "ENV"],
] as const;
const depts: Record<string, string> = {};
for (const [name, code] of deptData) depts[code] = (await prisma.department.create({ data: { name, code, email: `${code.toLowerCase()}@ward-office.test` } })).id;
const CATS = [
  { slug: "water", name: "Water", icon: "water", color: "#1b66e3", sla: 48, dept: "WATER", weight: 26 },
  { slug: "roads", name: "Roads", icon: "roads", color: "#f5901d", sla: 120, dept: "RNB", weight: 22 },
  { slug: "drainage", name: "Drainage", icon: "drainage", color: "#14b8c4", sla: 72, dept: "DRN", weight: 18 },
  { slug: "garbage", name: "Sanitation", icon: "garbage", color: "#22a04b", sla: 48, dept: "PHS", weight: 14 },
  { slug: "electricity", name: "Electricity", icon: "electricity", color: "#ffa918", sla: 24, dept: "ELEC", weight: 4 },
  { slug: "streetlight", name: "Streetlight", icon: "streetlight", color: "#ea7c0c", sla: 72, dept: "ELEC", weight: 4 },
  { slug: "healthcare", name: "Healthcare", icon: "healthcare", color: "#de0d22", sla: 72, dept: "HLTH", weight: 3 },
  { slug: "education", name: "Education", icon: "education", color: "#7a45e4", sla: 168, dept: "EDU", weight: 3 },
  { slug: "employment", name: "Employment", icon: "employment", color: "#b45309", sla: 168, dept: "RDE", weight: 2 },
  { slug: "agriculture", name: "Agriculture", icon: "agriculture", color: "#65a30d", sla: 120, dept: "AGRI", weight: 2 },
  { slug: "environment", name: "Environment", icon: "environment", color: "#0f766e", sla: 96, dept: "ENV", weight: 2 },
  { slug: "other", name: "Other", icon: "other", color: "#8a96ad", sla: 120, dept: "TP", weight: 0 },
];
const cats: Record<string, { id: string; sla: number; dept: string; name: string }> = {};
for (const [i, c] of CATS.entries()) {
  const row = await prisma.category.create({ data: { slug: c.slug, name: c.name, icon: c.icon, color: c.color, slaHours: c.sla, sortOrder: i, departmentId: depts[c.dept] } });
  cats[c.slug] = { id: row.id, sla: c.sla, dept: depts[c.dept], name: c.name };
}
const FIRST = ["Lakshmi", "Ravi", "Sravani", "Venkatesh", "Padma", "Srinivas", "Anitha", "Kiran", "Durga", "Prasad", "Swathi", "Naresh", "Bhavani", "Ramesh", "Sujatha", "Mahesh", "Kavya", "Suresh", "Divya", "Rajesh", "Haritha", "Gopi", "Sirisha", "Murali"];
const LAST = ["Reddy", "Naidu", "Rao", "Sharma", "Kumar", "Devi", "Babu", "Chowdary", "Varma", "Prasad", "Murthy", "Raju"];
const staffByDept: Record<string, string[]> = {};
for (const code of Object.keys(depts)) {
  staffByDept[depts[code]] = [];
  for (let i = 0; i < 3; i++) {
    const s = await prisma.staffMember.create({ data: { name: `${pick(FIRST)} ${pick(LAST)}`, designation: pick(["Assistant Engineer", "Sanitary Inspector", "Junior Engineer", "Field Supervisor", "Work Inspector"]), departmentId: depts[code], phone: `+91 9${int(100000000, 999999999)}` } });
    staffByDept[depts[code]].push(s.id);
  }
}

// ── Indicators & 24 months of readings ──────────────────────────────────────
console.log("Creating indicators and monthly readings…");
// The company profile's Ward Development Assessment model (weights total 100).
const IND = [
  { key: "drinking_water", name: "Drinking Water", unit: "% households with regular piped water supply", icon: "water", weight: 20, offset: 7 },
  { key: "roads", name: "Roads", unit: "% road length in good condition", icon: "roads", weight: 15, offset: -4 },
  { key: "drainage", name: "Drainage", unit: "% households connected to drains", icon: "drainage", weight: 15, offset: 0 },
  { key: "sanitation", name: "Sanitation", unit: "% households with door-to-door waste collection", icon: "sanitation", weight: 15, offset: 4 },
  { key: "healthcare", name: "Healthcare", unit: "% population within 2 km of a health centre", icon: "healthcare", weight: 10, offset: -9 },
  { key: "education", name: "Education", unit: "% schools meeting basic infrastructure norms (UDISE+)", icon: "education", weight: 10, offset: -3 },
  { key: "employment", name: "Employment", unit: "% households seeking work that received it (MGNREGA / urban schemes)", icon: "employment", weight: 10, offset: -11 },
  { key: "electricity", name: "Electricity", unit: "% streetlights working", icon: "electricity", weight: 5, offset: 6 },
];
const indIds: Record<string, string> = {};
for (const [i, d] of IND.entries()) indIds[d.key] = (await prisma.indicatorDefinition.create({ data: { key: d.key, name: d.name, unit: d.unit, icon: d.icon, weight: d.weight, target: 100, worst: 0, higherIsBetter: true, sortOrder: i, description: `Synthetic monthly survey value (${d.unit}).` } })).id;
const readings: Prisma.IndicatorReadingCreateManyInput[] = [];
const thisMonth = monthStart(NOW);
for (const w of wards) {
  for (let m = 12; m >= 0; m--) {
    const period = addMonths(thisMonth, -m);
    const t = 12 - m; // months since start → gradual improvement
    for (const d of IND) {
      const sparse = w.body.startsWith("Mopidevi") && w.number === 3 && m <= 1 && !["drinking_water", "roads"].includes(d.key);
      if (sparse) continue; // demonstrates "insufficient data"
      const value = clamp(w.quality - 6 + d.offset + t * 0.6 + between(-2.2, 2.2), 5, 100);
      readings.push({ wardId: w.id, indicatorId: indIds[d.key], period, value: Math.round(value * 10) / 10, source: "seed:synthetic-survey" });
    }
  }
}
for (let i = 0; i < readings.length; i += 2000) await prisma.indicatorReading.createMany({ data: readings.slice(i, i + 2000) });

// ── Accounts ────────────────────────────────────────────────────────────────
console.log("Creating demo accounts…");
const { DEMO_ACCOUNTS } = await import("./demo-accounts");
type Ref = { district: string; localBody: string; bodyType?: string };
const findBody = async (r: Ref) => {
  const lb = await prisma.localBody.findFirst({ where: { name: r.localBody, district: { name: r.district }, ...(r.bodyType ? { type: r.bodyType as never } : {}) }, select: { id: true } });
  if (!lb) throw new Error(`Demo account: local body "${r.localBody}" (${r.district}) not found in the LGD data`);
  return lb.id;
};
const findWard = async (r: Ref & { ward: number }) => {
  const w = await prisma.ward.findFirst({ where: { number: r.ward, localBodyId: await findBody(r) }, select: { id: true } });
  if (!w) throw new Error(`Demo account: ward ${r.ward} of ${r.localBody} not found`);
  return w.id;
};
const findDistrict = async (name: string) => { const d = await prisma.district.findFirst({ where: { name }, select: { id: true } }); if (!d) throw new Error(`Demo account: district ${name} not found`); return d.id; };
const demoIds: Record<string, string> = {};
const demoWard: Record<string, string> = {};
for (const a of DEMO_ACCOUNTS) {
  await auth.api.signUpEmail({ body: { name: a.name, email: a.email, password: a.password } });
  const scopes: Prisma.AdminScopeCreateWithoutUserInput[] = [];
  for (const sc of a.scopes ?? []) {
    if (sc.type === "DISTRICT") scopes.push({ district: { connect: { id: await findDistrict(sc.district) } } });
    else if (sc.type === "LOCAL_BODY") scopes.push({ localBody: { connect: { id: await findBody(sc) } } });
    else scopes.push({ ward: { connect: { id: await findWard(sc) } } });
  }
  const wardId = a.home ? await findWard(a.home) : null;
  const u = await prisma.user.update({ where: { email: a.email }, data: { role: a.role, emailVerified: a.emailVerified !== false, isActive: a.active !== false, wardId, scopes: { create: scopes } } });
  demoIds[a.email] = u.id;
  if (wardId) demoWard[a.email] = wardId;
}
console.log(`  ${DEMO_ACCOUNTS.length} demo accounts (see docs/ACCOUNTS.md)`);
// Synthetic residents (no login credentials; they only author historical complaints).
const residentsByWard: Record<string, string[]> = {};
const residents: Prisma.UserCreateManyInput[] = [];
for (const w of wards) {
  residentsByWard[w.id] = [];
  for (let i = 0; i < (w.tier === "pilot" ? 6 : w.tier === "city" ? 4 : 2); i++) {
    const id = randomUUID();
    residents.push({ id, name: `${pick(FIRST)} ${pick(LAST)}`, email: `resident-${residents.length + 1}@example.invalid`, emailVerified: true, wardId: w.id, createdAt: new Date(NOW.getTime() - int(200, 700) * DAY) });
    residentsByWard[w.id].push(id);
  }
}
await prisma.user.createMany({ data: residents });
const wardAdminId = demoIds["wardadmin@smartward.test"];
const districtAdminId = demoIds["districtadmin@smartward.test"];

// ── Complaints ──────────────────────────────────────────────────────────────
console.log("Generating complaints and their histories…");
const TITLES: Record<string, string[]> = {
  water: ["No water supply for two days", "Low water pressure in the morning", "Pipeline leakage near the junction", "Contaminated tap water", "Public tap broken"],
  roads: ["Large pothole on main road", "Road damaged after cable work", "Speed breaker broken", "Road surface washed away", "Footpath slabs missing"],
  drainage: ["Drain overflowing onto the street", "Blocked side drain", "Open manhole near school", "Stagnant water after rain", "Drain cover broken"],
  garbage: ["Garbage not collected this week", "Overflowing community bin", "Waste dumped on vacant plot", "Burning garbage near houses", "Dead animal not removed"],
  electricity: ["Frequent power cuts", "Loose overhead wire", "Transformer sparking", "Electric pole leaning"],
  streetlight: ["Streetlight not working", "Streetlights on during the day", "Dark stretch near bus stop"],
  healthcare: ["Health sub-centre closed during hours", "No ORS stock at PHC", "Mosquito breeding near houses"],
  education: ["School toilets not functional", "Leaking roof in primary school", "No drinking water at the school", "Anganwadi building needs repair"],
  employment: ["MGNREGA wages pending for weeks", "No work allotted despite job card", "Request for a local skill-training centre"],
  agriculture: ["Irrigation canal blocked", "Damaged field channel", "Borewell motor not working for farmers"],
  environment: ["Low-lying area floods after rain", "Smoke from a factory near houses", "Waste dumped into the canal"],
  other: ["Stray cattle on the road", "Encroachment on footpath", "Noise from late-night construction"],
};
const RESOLUTION: Record<string, string> = {
  water: "Valve repaired and supply restored; line flushed and pressure checked.",
  roads: "Pothole filled with bituminous mix and compacted.",
  drainage: "Drain desilted and cover replaced.",
  garbage: "Area cleared and collection schedule restored.",
  electricity: "Line secured and supply restored by the electrical team.",
  streetlight: "Faulty fixture replaced with LED lamp.",
  healthcare: "Issue escalated to the health officer and resolved.",
  education: "School infrastructure repaired by the Education Department.",
  employment: "Case reviewed; pending wages released and work allotted.",
  agriculture: "Channel cleared and irrigation supply restored.",
  environment: "Site inspected and corrective action taken with the pollution control team.",
  other: "Inspected and resolved by the ward office.",
};
const weightedCat = () => { const r = rnd() * 100; let acc = 0; for (const c of CATS) { acc += c.weight; if (r < acc) return c.slug; } return "other"; };
const usedRefs = new Set<string>();
const complaints: Prisma.ComplaintCreateManyInput[] = [];
const history: Prisma.ComplaintStatusHistoryCreateManyInput[] = [];
const feedback: Prisma.ComplaintFeedbackCreateManyInput[] = [];
const comments: Prisma.ComplaintCommentCreateManyInput[] = [];
const assignments: Prisma.ComplaintAssignmentCreateManyInput[] = [];

type Plan = { ward: WardInfo; cat: string; createdAt: Date; reporter: string; forceOpen?: boolean; forceStatus?: ComplaintStatus; title?: string; isPublic?: boolean };
function addComplaint(p: Plan) {
  const id = randomUUID();
  let reference: string;
  do reference = makeReference(p.createdAt, randomBytes(6)); while (usedRefs.has(reference));
  usedRefs.add(reference);
  const cat = cats[p.cat];
  const severity = pick<Severity>(["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"]);
  const priority: Priority = severityToPriority(severity);
  const dueAt = computeDueAt(p.createdAt, cat.sla, priority);
  const ageDays = (NOW.getTime() - p.createdAt.getTime()) / DAY;
  const monthsAgo = ageDays / 30;
  const t = (h: number) => new Date(Math.min(p.createdAt.getTime() + h * HOUR, NOW.getTime() - 60_000));
  const staff = pick(staffByDept[cat.dept]);
  const admin = chance(0.6) ? wardAdminId : districtAdminId;

  // Decide outcome by age; resolution gets faster over time (improving trend).
  let status: ComplaintStatus;
  const r = rnd();
  if (p.forceStatus) status = p.forceStatus;
  else if (p.forceOpen) status = pick<ComplaintStatus>(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "IN_PROGRESS"]);
  else if (r < 0.02 && ageDays > 2) status = "REJECTED";
  else if (r < 0.035 && ageDays > 2) status = "DUPLICATE";
  else if (ageDays > 45) status = chance(0.95) ? (chance(0.72) ? "CLOSED" : "RESOLVED") : "IN_PROGRESS";
  else if (ageDays > 12) status = chance(0.82) ? (chance(0.55) ? "CLOSED" : "RESOLVED") : pick<ComplaintStatus>(["ASSIGNED", "IN_PROGRESS"]);
  else if (ageDays > 2) status = pick<ComplaintStatus>(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "RESOLVED", "CLOSED"]);
  else status = pick<ComplaintStatus>(["SUBMITTED", "SUBMITTED", "UNDER_REVIEW"]);

  const speed = clamp(1.25 - (12 - Math.min(12, monthsAgo)) * 0.06, 0.35, 1.3); // later months resolve faster
  const resolveH = Math.max(4, cat.sla * between(0.3, 1.25) * speed);
  let resolvedAt: Date | null = null, closedAt: Date | null = null;
  if (status === "RESOLVED" || status === "CLOSED") {
    resolvedAt = t(resolveH);
    if (resolvedAt > NOW) { status = "IN_PROGRESS"; resolvedAt = null; }
  }
  const steps: Array<[ComplaintStatus | null, ComplaintStatus, number, string | null]> = [[null, "SUBMITTED", 0, null]];
  const reviewH = Math.min(resolveH * 0.15, 8), assignH = Math.min(resolveH * 0.3, 20), workH = Math.min(resolveH * 0.5, 40);
  if (status === "REJECTED") steps.push(["SUBMITTED", "REJECTED", reviewH, "Outside the ward office's responsibility; forwarded to the State Highways division."]);
  else if (status === "DUPLICATE") steps.push(["SUBMITTED", "DUPLICATE", reviewH, "Already reported by a neighbour; tracked under the original complaint."]);
  else if (status !== "SUBMITTED") {
    steps.push(["SUBMITTED", "UNDER_REVIEW", reviewH, null]);
    if (status !== "UNDER_REVIEW") {
      steps.push(["UNDER_REVIEW", "ASSIGNED", assignH, `Assigned to ${deptData.find(([, c]) => depts[c] === cat.dept)?.[0] ?? "department"}`]);
      if (status !== "ASSIGNED") {
        steps.push(["ASSIGNED", "IN_PROGRESS", workH, null]);
        if (resolvedAt) {
          steps.push(["IN_PROGRESS", "RESOLVED", resolveH, RESOLUTION[p.cat]]);
          if (status === "CLOSED") {
            const closeH = resolveH + between(6, 60);
            closedAt = t(closeH) > NOW ? NOW : t(closeH);
            steps.push(["RESOLVED", "CLOSED", (closedAt.getTime() - p.createdAt.getTime()) / HOUR, "Citizen confirmed the problem is fixed."]);
            const rating = clamp(Math.round(between(2.6, 4.4) + (12 - Math.min(12, monthsAgo)) * 0.07 + between(-0.4, 0.6)), 1, 5);
            feedback.push({ id: randomUUID(), complaintId: id, citizenId: p.reporter, rating, satisfied: true, createdAt: closedAt });
          }
        }
      }
    }
  }
  if (status === "REJECTED" || status === "DUPLICATE") closedAt = t(reviewH);
  for (const [from, to, h, reason] of steps) {
    history.push({ id: randomUUID(), complaintId: id, fromStatus: from, toStatus: to, actorId: to === "SUBMITTED" || to === "CLOSED" && reason?.startsWith("Citizen") ? p.reporter : admin, reason, createdAt: t(h) });
  }
  const assigned = steps.some((s) => s[1] === "ASSIGNED");
  if (assigned) assignments.push({ id: randomUUID(), complaintId: id, departmentId: cat.dept, staffId: staff, assignedById: admin, createdAt: t(assignH) });
  if (assigned && chance(0.25)) comments.push({ id: randomUUID(), complaintId: id, authorId: admin, visibility: "PUBLIC", body: "Our team has inspected the site. Work is scheduled.", createdAt: t(workH * 0.9) });
  if (assigned && chance(0.15)) comments.push({ id: randomUUID(), complaintId: id, authorId: admin, visibility: "INTERNAL", body: "Contractor availability is limited this week; prioritise if it escalates.", createdAt: t(workH * 0.8) });
  complaints.push({
    id, reference, title: p.title ?? pick(TITLES[p.cat]), categoryId: cat.id, wardId: p.ward.id, reporterId: p.reporter,
    description: `${p.title ?? "Problem reported"} in Ward ${p.ward.number}. Residents nearby are affected and request urgent attention from the ward office. (Synthetic demo data.)`,
    address: `${pick(["Main Road", "2nd Cross", "Temple Street", "Bazaar Road", "School Lane", "Canal Bund Road"])}, Ward ${p.ward.number}`,
    landmark: chance(0.5) ? pick(["Near Ramalayam", "Opposite ZP High School", "Behind bus stand", "Near water tank", "Beside ration shop"]) : null,
    latitude: Number((p.ward.lat + between(-0.004, 0.004)).toFixed(6)), longitude: Number((p.ward.lng + between(-0.004, 0.004)).toFixed(6)),
    isPublic: p.isPublic ?? chance(0.7), supportCount: 0,
    severity, priority, status, departmentId: assigned ? cat.dept : null, assignedStaffId: assigned ? staff : null,
    resolutionNote: resolvedAt ? RESOLUTION[p.cat] : null, dueAt, resolvedAt, closedAt, createdAt: p.createdAt, updatedAt: closedAt ?? resolvedAt ?? p.createdAt,
  });
  return id;
}

// Baseline volume: ~3 per ward per month for 13 months, growing slowly.
for (const w of wards) {
  for (let d = 395; d >= 0; d--) {
    const day = new Date(NOW.getTime() - d * DAY);
    if (day < w.createdAt) continue;
    const rate = ((w.kind === "ULB" ? 2.4 + ((395 - d) / 395) * 1.1 : 0.25 + ((395 - d) / 395) * 0.15) / 30) * (w.tier === "city" ? 0.35 : 1);
    if (chance(rate)) addComplaint({ ward: w, cat: weightedCat(), createdAt: new Date(day.getTime() + int(7, 20) * HOUR), reporter: pick(residentsByWard[w.id]) });
  }
}
// Planted patterns so rule-based insights have something real to find:
// 1) a surge of water complaints in 12 Krishna-district wards over the last 30 days
const waterWards = wards.filter((w) => w.body.startsWith("Machilipatnam")).slice(0, 9).concat(wards.filter((w) => w.body.startsWith("Gudivada")).slice(0, 3));
const waterSurge = new Set<string>();
for (const w of waterWards) for (let i = 0; i < int(5, 7); i++) waterSurge.add(addComplaint({ ward: w, cat: "water", createdAt: new Date(NOW.getTime() - between(1, 26) * DAY), reporter: pick(residentsByWard[w.id]), forceOpen: chance(0.75), isPublic: true, title: pick(["No water supply for two days", "Low water pressure in the morning"]) }));
// 2) overdue road complaints in four wards
for (const w of [wardOf("Vijayawada Municipal", 3), wardOf("Vijayawada Municipal", 7), wardOf("Gudivada", 2), wardOf("Machilipatnam", 5)])
  for (let i = 0; i < int(4, 7); i++) addComplaint({ ward: w, cat: "roads", createdAt: new Date(NOW.getTime() - between(9, 24) * DAY), reporter: pick(residentsByWard[w.id]), forceStatus: pick<ComplaintStatus>(["ASSIGNED", "IN_PROGRESS"]) });
// 3) repeated drainage complaints in Pedana
for (const n of [1, 2]) { const w = wardOf("Pedana", n); for (let i = 0; i < int(7, 10); i++) addComplaint({ ward: w, cat: "drainage", createdAt: new Date(NOW.getTime() - between(3, 85) * DAY), reporter: pick(residentsByWard[w.id]) }); }
// 4) sanitation backlog in Guntur ward 4
{ const w = wardOf("Vuyyuru", 4); for (let i = 0; i < 5; i++) addComplaint({ ward: w, cat: "garbage", createdAt: new Date(NOW.getTime() - between(4, 10) * DAY), reporter: pick(residentsByWard[w.id]), forceStatus: "IN_PROGRESS" }); }

// Demo citizen's own complaints, covering the main lifecycle states.
const lakshmi = demoIds["citizen@smartward.test"];
const w12 = wardOf("Machilipatnam", 12);
const demoComplaints = {
  awaitingReview: addComplaint({ ward: w12, cat: "water", createdAt: new Date(NOW.getTime() - 6 * DAY), reporter: lakshmi, isPublic: true, forceStatus: "RESOLVED", title: "No water supply on 3rd Cross for three days" }),
  inProgress: addComplaint({ ward: w12, cat: "streetlight", createdAt: new Date(NOW.getTime() - 3 * DAY), reporter: lakshmi, isPublic: true, forceStatus: "IN_PROGRESS", title: "Streetlights not working near the school" }),
  submitted: addComplaint({ ward: w12, cat: "drainage", createdAt: new Date(NOW.getTime() - 5 * HOUR), reporter: lakshmi, isPublic: false, forceStatus: "SUBMITTED", title: "Drain overflowing outside house no. 12-4-56" }),
  closed: addComplaint({ ward: w12, cat: "roads", createdAt: new Date(NOW.getTime() - 40 * DAY), reporter: lakshmi, isPublic: true, forceStatus: "CLOSED", title: "Pothole at the market junction" }),
  rejected: addComplaint({ ward: w12, cat: "other", createdAt: new Date(NOW.getTime() - 20 * DAY), reporter: lakshmi, isPublic: false, forceStatus: "REJECTED", title: "National highway service road damaged" }),
};
// Every other active, verified demo citizen gets two reports of their own: one in progress, one resolved.
for (const a of DEMO_ACCOUNTS.filter((x) => x.role === "CITIZEN" && x.email !== "citizen@smartward.test" && x.emailVerified !== false && x.active !== false)) {
  const w = wards.find((x) => x.id === demoWard[a.email]);
  if (!w) continue;
  addComplaint({ ward: w, cat: pick(["water", "roads", "drainage", "garbage", "streetlight"]), createdAt: new Date(NOW.getTime() - int(2, 9) * DAY), reporter: demoIds[a.email], isPublic: true, forceStatus: "IN_PROGRESS" });
  addComplaint({ ward: w, cat: pick(["water", "roads", "drainage", "garbage", "streetlight"]), createdAt: new Date(NOW.getTime() - int(25, 60) * DAY), reporter: demoIds[a.email], isPublic: true, forceStatus: "RESOLVED" });
}
// forceStatus RESOLVED with a recent date may have been downgraded; make the review example deterministic.
{
  const c = complaints.find((x) => x.id === demoComplaints.awaitingReview)!;
  if (c.status !== "RESOLVED") {
    c.status = "RESOLVED"; c.resolvedAt = new Date(NOW.getTime() - 1 * DAY); c.resolutionNote = RESOLUTION.water; c.departmentId = cats.water.dept;
    history.push({ id: randomUUID(), complaintId: c.id as string, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", actorId: wardAdminId, reason: RESOLUTION.water, createdAt: c.resolvedAt });
  }
}

// Neighbours supporting public reports (more support where water problems are surging).
const supports: Prisma.ComplaintSupportCreateManyInput[] = [];
for (const c of complaints) {
  if (!c.isPublic || c.status === "REJECTED" || c.status === "DUPLICATE") continue;
  const pool = residentsByWard[c.wardId].filter((u) => u !== c.reporterId);
  const k = Math.min(pool.length, waterSurge.has(c.id as string) ? int(2, 5) : pick([0, 0, 0, 1, 1, 2, 3, 4]));
  const chosen = [...pool].sort(() => rnd() - 0.5).slice(0, k);
  const created = new Date(c.createdAt as Date).getTime();
  for (const userId of chosen) supports.push({ id: randomUUID(), complaintId: c.id as string, userId, createdAt: new Date(Math.min(NOW.getTime() - 60_000, created + between(1, 72) * HOUR)) });
  c.supportCount = k;
}
for (let i = 0; i < complaints.length; i += 1000) await prisma.complaint.createMany({ data: complaints.slice(i, i + 1000) });
for (let i = 0; i < history.length; i += 2000) await prisma.complaintStatusHistory.createMany({ data: history.slice(i, i + 2000) });
for (let i = 0; i < assignments.length; i += 2000) await prisma.complaintAssignment.createMany({ data: assignments.slice(i, i + 2000) });
await prisma.complaintFeedback.createMany({ data: feedback });
await prisma.complaintComment.createMany({ data: comments });
for (let i = 0; i < supports.length; i += 2000) await prisma.complaintSupport.createMany({ data: supports.slice(i, i + 2000) });
console.log(`  ${complaints.length} complaints, ${history.length} status changes, ${feedback.length} feedback entries, ${supports.length} supports`);

// Sample photos for the demo citizen's complaints (skipped if object storage is not running).
try {
  const { putObject } = await import("../src/lib/storage");
  const report = readFileSync(join(process.cwd(), "prisma/seed-assets/sample-report.png"));
  const evidence = readFileSync(join(process.cwd(), "prisma/seed-assets/sample-evidence.png"));
  const files: Array<[string, Buffer, "COMPLAINT" | "RESOLUTION", string]> = [
    [demoComplaints.awaitingReview, report, "COMPLAINT", lakshmi], [demoComplaints.awaitingReview, evidence, "RESOLUTION", wardAdminId],
    [demoComplaints.inProgress, report, "COMPLAINT", lakshmi], [demoComplaints.closed, report, "COMPLAINT", lakshmi], [demoComplaints.closed, evidence, "RESOLUTION", wardAdminId],
  ];
  for (const [complaintId, buf, purpose, uploaderId] of files) {
    const key = `seed/${randomUUID()}.png`;
    await putObject(key, new Uint8Array(buf), "image/png");
    await prisma.attachment.create({ data: { storageKey: key, fileName: purpose === "COMPLAINT" ? "sample-photo.png" : "resolution-evidence.png", mimeType: "image/png", size: buf.length, purpose, uploaderId, complaintId } });
  }
  console.log("  uploaded sample photos to object storage");
} catch (err) {
  console.warn("  ! Object storage unavailable — demo complaints were created without sample photos.", (err as Error).message);
}

// ── Projects ────────────────────────────────────────────────────────────────
console.log("Creating projects…");
type ProjSeed = { name: string; ward: WardInfo; cat: string; status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED"; milestones: Array<[string, number, boolean]>; budget: number; monthsAgo: number; durationMonths: number };
const PROJECTS: ProjSeed[] = [
  { name: "KRMC Road Widening", ward: wardOf("Machilipatnam", 3), cat: "roads", status: "IN_PROGRESS", budget: 42_500_000, monthsAgo: 10, durationMonths: 14,
    milestones: Array.from({ length: 13 }, (_, i) => [`Stretch ${i + 1} widened and surfaced`, 1, i < 12] as [string, number, boolean]) },
  { name: "Drinking Water Scheme", ward: wardOf("Kuchipudi", 1), cat: "water", status: "IN_PROGRESS", budget: 68_000_000, monthsAgo: 9, durationMonths: 15,
    milestones: [["Source survey", 5, true], ["Pipeline tender awarded", 5, true], ["Overhead tank built", 4, true], ["Trunk main laid", 3, true], ["House connections", 8, false]] },
  { name: "Drainage Improvement", ward: wardOf("Machilipatnam", 12), cat: "drainage", status: "COMPLETED", budget: 18_500_000, monthsAgo: 14, durationMonths: 10,
    milestones: [["Survey & design", 1, true], ["Desilting", 2, true], ["New side drains", 3, true], ["Outfall repair", 2, true]] },
];
const extraNames: Record<string, string[]> = {
  streetlight: ["LED Streetlight Upgrade"], garbage: ["Waste Segregation Shed", "Door-to-Door Collection Vehicles"], healthcare: ["Health Sub-Centre Renovation"], education: ["School Infrastructure Upgrade"], agriculture: ["Irrigation Canal Lining"],
  roads: ["CC Road Laying", "Footpath & Crossing Upgrade"], water: ["Overhead Water Tank", "Pipeline Replacement"], drainage: ["Storm Water Drain Desilting"],
};
for (let i = 0; i < 21; i++) {
  const cat = pick(Object.keys(extraNames));
  const ms = int(3, 6);
  const done = int(0, ms);
  PROJECTS.push({ name: `${pick(extraNames[cat])} — ${["Phase I", "Phase II", "Ward package"][i % 3]}`, ward: pick(wards.filter((w) => w.kind === "ULB" || w.number <= 3)), cat, status: done === ms ? "COMPLETED" : done === 0 ? (chance(0.5) ? "PLANNED" : "ON_HOLD") : "IN_PROGRESS",
    budget: int(10, 400) * 100_000, monthsAgo: int(1, 14), durationMonths: int(4, 16),
    milestones: Array.from({ length: ms }, (_, k) => [pick(["Detailed project report", "Tender & award", "Site mobilisation", "Civil works", "Installation", "Quality inspection", "Handover"]) + ` (${k + 1})`, int(1, 3), k < done] as [string, number, boolean]) });
}
for (const [i, p] of PROJECTS.entries()) {
  const start = addMonths(thisMonth, -p.monthsAgo);
  const target = addMonths(start, p.durationMonths);
  const total = p.milestones.reduce((s, m) => s + m[1], 0);
  const progress = Math.round((p.milestones.filter((m) => m[2]).reduce((s, m) => s + m[1], 0) / total) * 100);
  const project = await prisma.project.create({
    data: {
      code: `PRJ-${String(start.getUTCFullYear()).slice(-2)}-${String(1000 + i)}`, name: p.name, description: `${p.name} for Ward ${p.ward.number}, ${p.ward.body}. Synthetic demonstration project with milestone-based progress tracking.`,
      categoryId: cats[p.cat].id, wardId: p.ward.id, departmentId: cats[p.cat].dept, budget: p.budget, expenditure: Math.round(p.budget * (progress / 100) * between(0.8, 1.05)),
      startDate: start, targetDate: target, status: p.status, progress, progressMode: "MILESTONES", isPublic: i % 7 !== 6,
      completedAt: p.status === "COMPLETED" ? new Date(NOW.getTime() - int(5, 40) * DAY) : null, createdById: districtAdminId, createdAt: start, updatedAt: new Date(NOW.getTime() - int(0, 20) * DAY),
      milestones: { create: p.milestones.map(([title, weight, isDone], k) => ({ title, weight, sortOrder: k, dueDate: new Date(start.getTime() + ((k + 1) / p.milestones.length) * (target.getTime() - start.getTime())), completedAt: isDone ? new Date(start.getTime() + ((k + 0.8) / p.milestones.length) * Math.min(NOW.getTime() - start.getTime(), target.getTime() - start.getTime())) : null })) },
      progressLogs: { create: [{ progress: 0, source: "MILESTONES", actorId: districtAdminId, note: "Project created", createdAt: start }, { progress, source: "MILESTONES", actorId: wardAdminId, note: "Milestone progress updated", createdAt: new Date(NOW.getTime() - int(1, 25) * DAY) }] },
    },
  });
  void project;
}

// ── Engagement ──────────────────────────────────────────────────────────────
console.log("Creating meetings, announcements, inquiries and notifications…");
const superId = demoIds["superadmin@smartward.test"];
await prisma.meeting.create({ data: {
  title: "Monthly district development review", agenda: "1. Overdue road complaints\n2. Water supply alerts in Machilipatnam and Gudivada\n3. Project milestones at risk",
  scheduledAt: new Date(NOW.getTime() - 12 * DAY), location: "Collectorate Conference Hall, Machilipatnam", status: "COMPLETED", districtId: districtIds.Krishna, createdById: districtAdminId,
  minutes: "Reviewed water complaints; tanker support approved for affected wards. Road repair batch to be tendered.",
  participants: { create: [{ name: "Dr. Ramesh Kumar", role: "Organiser", userId: districtAdminId, email: "districtadmin@smartward.test" }, { name: "Suresh Babu", role: "Ward Administrator", userId: wardAdminId, email: "wardadmin@smartward.test" }, { name: "Executive Engineer, Water Supply", role: "Department head" }] },
  actionItems: { create: [{ description: "Deploy tankers to wards with water alerts", ownerName: "Water Supply Department", dueDate: new Date(NOW.getTime() - 5 * DAY), status: "DONE" }, { description: "Batch overdue road complaints into one work order", ownerName: "Roads & Buildings", dueDate: new Date(NOW.getTime() + 4 * DAY), status: "IN_PROGRESS" }, { description: "Publish monsoon preparedness notice", ownerName: "Suresh Babu", dueDate: new Date(NOW.getTime() - 2 * DAY), status: "OPEN" }] },
} });
await prisma.meeting.create({ data: { title: "Machilipatnam ward review", agenda: "Ward-wise complaint backlog and drainage project handover.", scheduledAt: new Date(NOW.getTime() + 6 * DAY), location: "Municipal Office, Machilipatnam", wardId: w12.id, createdById: wardAdminId, participants: { create: [{ name: "Suresh Babu", role: "Organiser", userId: wardAdminId }] } } });
await prisma.announcement.createMany({ data: [
  { title: "Welcome to the Smart Ward India demo", body: "This independent demonstration uses synthetic data. Try reporting an issue and following it through to resolution.", isPublished: true, publishedAt: new Date(NOW.getTime() - 30 * DAY), createdById: superId },
  { title: "Monsoon preparedness drive", body: "Drain desilting is under way across Krishna district. Report blocked drains through the portal.", districtId: districtIds.Krishna, isPublished: true, publishedAt: new Date(NOW.getTime() - 8 * DAY), createdById: districtAdminId },
  { title: "Revised water supply timings", body: "Ward 12 will receive supply from 6–8 am and 5–7 pm while the pipeline is repaired.", wardId: w12.id, isPublished: true, publishedAt: new Date(NOW.getTime() - 2 * DAY), createdById: wardAdminId },
] });
await prisma.partnerInquiry.createMany({ data: [
  { name: "Anjali Mehta", organization: "Coastal Districts CSR Foundation", email: "anjali@example.org", type: "CSR", message: "We would like to fund streetlight upgrades in two wards and track progress publicly.", status: "NEW" },
  { name: "Prof. K. Srinivas", organization: "Regional Engineering College", email: "ks@example.edu", type: "INNOVATION", message: "Our students can help validate indicator data collection methods for drainage coverage.", status: "IN_REVIEW" },
  { name: "Municipal Commissioner's Office", organization: "Example Municipality", email: "office@example.gov.test", type: "GOVERNMENT", message: "Interested in a pilot for our 20 wards next quarter. Please share onboarding steps.", status: "RESPONDED" },
] });
await prisma.notification.createMany({ data: [
  { userId: lakshmi, type: "complaint.status", title: "Your water complaint is resolved", body: "Please review the resolution and tell us if the problem is fixed.", link: `/portal/complaints/${demoComplaints.awaitingReview}`, createdAt: new Date(NOW.getTime() - 1 * DAY) },
  { userId: lakshmi, type: "complaint.status", title: "Streetlight complaint is in progress", body: "The Electrical Department is working on it.", link: `/portal/complaints/${demoComplaints.inProgress}`, createdAt: new Date(NOW.getTime() - 2 * DAY) },
  { userId: lakshmi, type: "announcement", title: "Revised water supply timings", body: "Ward 12 will receive supply from 6–8 am and 5–7 pm.", link: "/portal", createdAt: new Date(NOW.getTime() - 2 * DAY), readAt: new Date(NOW.getTime() - 1 * DAY) },
] });

// ── Settings, scores and insights (computed from the records above) ─────────
await setSetting("content.site", DEFAULT_CONTENT, null);
await setSetting("scoring.minCoverage", 0.6, null);
console.log("Computing development scores…");
const s = await recomputeSnapshots({ replaceAll: true });
console.log(`  ${s.snapshots} ward-month snapshots`);
console.log("Running insight rules…");
const ins = await generateInsights(NOW);
console.log(`  ${ins.active} active insights`);

console.log("\nDemo accounts (DEVELOPMENT ONLY):");
for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(15)} ${a.email.padEnd(30)} ${a.password}`);
console.log("\nSeed complete.");
await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
