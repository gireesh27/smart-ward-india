import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { canAssignRole, type Actor } from "@/lib/authz";
import { createProject, toggleMilestone, addMilestone, recordManualProgress } from "@/lib/services/projects";
import { buildExport } from "@/lib/services/reports";
import { getDashboard } from "@/lib/services/analytics";
import { recomputeSnapshots } from "@/lib/services/scores";
import { code, hasDb, makeActor, resetDb, world } from "./helpers";

const project = (wardId: string, categoryId: string) => ({ name: "Pipeline replacement", description: "Replace 2 km of old pipeline", categoryId, wardId, budget: 1_000_000, expenditure: 0, startDate: new Date("2026-01-01"), targetDate: new Date("2026-12-31"), status: "IN_PROGRESS" as const, progressMode: "MILESTONES" as const, isPublic: true });

describe("role rules", () => {
  it("only super admins grant district/super roles", () => {
    expect(canAssignRole({ role: "DISTRICT_ADMIN" } as Actor, "WARD_ADMIN")).toBe(true);
    expect(canAssignRole({ role: "DISTRICT_ADMIN" } as Actor, "DISTRICT_ADMIN")).toBe(false);
    expect(canAssignRole({ role: "WARD_ADMIN" } as Actor, "WARD_ADMIN")).toBe(false);
    expect(canAssignRole({ role: "SUPER_ADMIN" } as Actor, "SUPER_ADMIN")).toBe(true);
  });
});

describe.skipIf(!hasDb)("projects, scores, dashboards and exports (database)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeEach(async () => { await resetDb(); w = await world(); });

  it("enforces ward scope on projects and derives progress from milestones", async () => {
    const adminA = await makeActor("WARD_ADMIN", { wardId: w.wardA.id });
    expect(await code(createProject(adminA, project(w.wardB.id, w.cat.id)))).toBe("404:NOT_FOUND");
    const { id } = await createProject(adminA, project(w.wardA.id, w.cat.id));
    await addMilestone(adminA, id, { title: "Survey", weight: 1 });
    await addMilestone(adminA, id, { title: "Works", weight: 3 });
    const ms = await prisma.milestone.findMany({ where: { projectId: id }, orderBy: { sortOrder: "asc" } });
    await toggleMilestone(adminA, id, ms[1].id, true);
    expect((await prisma.project.findUniqueOrThrow({ where: { id } })).progress).toBe(75);
    expect(await code(recordManualProgress(adminA, id, { progress: 90, note: "manual override" }))).toBe("422:MILESTONE_MODE");
  });

  it("computes dashboard figures from stored records, within scope", async () => {
    const water = await prisma.indicatorDefinition.create({ data: { key: "water", name: "Water", unit: "%", weight: 1, target: 100 } });
    const now = new Date();
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    await prisma.indicatorReading.createMany({ data: [{ wardId: w.wardA.id, indicatorId: water.id, period, value: 80 }, { wardId: w.wardB.id, indicatorId: water.id, period, value: 60 }] });
    await recomputeSnapshots();
    const sup = await makeActor("SUPER_ADMIN");
    const d = await getDashboard(sup, {}, now);
    expect(d.kpis.devScore).toBe(70);
    expect(d.kpis.totalWards).toBe(2);
    const north = await makeActor("DISTRICT_ADMIN", { districtId: w.d1.id });
    expect((await getDashboard(north, {}, now)).kpis.devScore).toBe(80);
  });

  it("exports only in-scope rows, without reporter identity, and records the export", async () => {
    const citizen = await makeActor("CITIZEN");
    let n = 0;
    for (const wardId of [w.wardA.id, w.wardB.id]) await prisma.complaint.create({ data: { reference: `SWI-2611-TEST0${n++}`, title: "t", description: "d", categoryId: w.cat.id, wardId, reporterId: citizen.id, address: "a" } });
    const adminA = await makeActor("WARD_ADMIN", { wardId: w.wardA.id });
    const out = await buildExport(adminA, { type: "complaints", format: "csv" });
    expect(String(out.body).trim().split("\r\n")).toHaveLength(2); // header + one in-scope row
    expect(String(out.body)).not.toContain(citizen.email);
    expect(await prisma.reportExport.count({ where: { userId: adminA.id } })).toBe(1);
    expect((await buildExport(adminA, { type: "wards", format: "pdf" })).contentType).toBe("application/pdf");
  });
});
