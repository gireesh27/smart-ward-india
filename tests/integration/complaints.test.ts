import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addComment, assignComplaint, changeStatus, createComplaint, getComplaintForActor, listComplaints, listPublicIssues, submitFeedback, supportComplaint, unsupportComplaint } from "@/lib/services/complaints";
import { complaintListSchema } from "@/lib/validation";
import { code, evidenceFor, hasDb, makeActor, resetDb, world } from "./helpers";

const input = (wardId: string, categoryId: string) => ({ wardId, categoryId, title: "No water for two days", description: "Taps have been dry since Monday morning in our lane.", address: "2nd Cross, Ward 1", severity: "HIGH" as const, attachmentIds: [], isPublic: false, idempotencyKey: randomUUID() });

describe.skipIf(!hasDb)("complaint workflow & authorization (database)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeEach(async () => { await resetDb(); w = await world(); });

  it("creates a complaint with history and is idempotent per key", async () => {
    const citizen = await makeActor("CITIZEN");
    const body = input(w.wardA.id, w.cat.id);
    const a = await createComplaint(citizen, body);
    const b = await createComplaint(citizen, body);
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
    expect(await prisma.complaint.count()).toBe(1);
    expect(await prisma.complaintStatusHistory.count({ where: { complaintId: a.id } })).toBe(1);
  });

  it("hides other citizens' complaints and out-of-scope wards (404, not 403)", async () => {
    const owner = await makeActor("CITIZEN");
    const other = await makeActor("CITIZEN");
    const wardAdminB = await makeActor("WARD_ADMIN", { wardId: w.wardB.id });
    const c = await createComplaint(owner, input(w.wardA.id, w.cat.id));
    expect(await code(getComplaintForActor(other, c.id))).toBe("404:NOT_FOUND");
    expect(await code(getComplaintForActor(wardAdminB, c.id))).toBe("404:NOT_FOUND");
    expect(await code(changeStatus(wardAdminB, c.id, { status: "UNDER_REVIEW", evidenceIds: [] }))).toBe("404:NOT_FOUND");
    expect((await listComplaints(other, complaintListSchema.parse({}))).total).toBe(0);
  });

  it("district admins see their district; super admins see everything", async () => {
    const citizen = await makeActor("CITIZEN");
    await createComplaint(citizen, input(w.wardA.id, w.cat.id));
    await createComplaint(citizen, input(w.wardB.id, w.cat.id));
    const north = await makeActor("DISTRICT_ADMIN", { districtId: w.d1.id });
    const sup = await makeActor("SUPER_ADMIN");
    expect((await listComplaints(north, complaintListSchema.parse({}))).total).toBe(1);
    expect((await listComplaints(sup, complaintListSchema.parse({}))).total).toBe(2);
  });

  it("runs the full lifecycle: assign → progress → resolve with evidence → citizen closes", async () => {
    const citizen = await makeActor("CITIZEN");
    const admin = await makeActor("WARD_ADMIN", { wardId: w.wardA.id });
    const c = await createComplaint(citizen, input(w.wardA.id, w.cat.id));
    expect((await assignComplaint(admin, c.id, { departmentId: w.dept.id })).status).toBe("ASSIGNED");
    await changeStatus(admin, c.id, { status: "IN_PROGRESS", evidenceIds: [] });
    expect(await code(changeStatus(admin, c.id, { status: "RESOLVED", resolutionNote: "Valve replaced on the main line", evidenceIds: [] }))).toBe("422:MISSING_REQUIREMENT");
    const ev = await evidenceFor(admin);
    await changeStatus(admin, c.id, { status: "RESOLVED", resolutionNote: "Valve replaced on the main line", evidenceIds: [ev.id] });
    expect(await code(changeStatus(citizen, c.id, { status: "REOPENED", reason: "not fixed at all", evidenceIds: [] }))).toBe("422:INVALID_TRANSITION");
    expect(await submitFeedback(citizen, c.id, { rating: 5, satisfied: true })).toEqual({ closed: true });
    const final = await prisma.complaint.findUniqueOrThrow({ where: { id: c.id }, include: { history: { orderBy: { createdAt: "asc" } } } });
    expect(final.status).toBe("CLOSED");
    expect(final.history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
    expect(await prisma.auditLog.count({ where: { entityId: c.id } })).toBeGreaterThanOrEqual(3);
  });

  it("supports reopen requests and admin review", async () => {
    const citizen = await makeActor("CITIZEN");
    const admin = await makeActor("WARD_ADMIN", { wardId: w.wardA.id });
    const c = await createComplaint(citizen, input(w.wardA.id, w.cat.id));
    await assignComplaint(admin, c.id, { departmentId: w.dept.id });
    await changeStatus(admin, c.id, { status: "IN_PROGRESS", evidenceIds: [] });
    await changeStatus(admin, c.id, { status: "RESOLVED", resolutionNote: "Pipe joint resealed", evidenceIds: [(await evidenceFor(admin)).id] });
    await changeStatus(citizen, c.id, { status: "REOPEN_REQUESTED", reason: "Leak returned the next day", evidenceIds: [] });
    await changeStatus(admin, c.id, { status: "REOPENED", reason: "Confirmed on inspection", evidenceIds: [] });
    expect((await prisma.complaint.findUniqueOrThrow({ where: { id: c.id } })).resolvedAt).toBeNull();
  });

  it("keeps internal notes away from citizens", async () => {
    const citizen = await makeActor("CITIZEN");
    const admin = await makeActor("WARD_ADMIN", { wardId: w.wardA.id });
    const c = await createComplaint(citizen, input(w.wardA.id, w.cat.id));
    await addComment(admin, c.id, { body: "Contractor delayed", visibility: "INTERNAL", attachmentIds: [] });
    await addComment(admin, c.id, { body: "Team visits tomorrow", visibility: "PUBLIC", attachmentIds: [] });
    await addComment(citizen, c.id, { body: "Trying to post an internal note", visibility: "INTERNAL", attachmentIds: [] });
    const view = await getComplaintForActor(citizen, c.id);
    expect(view.complaint.comments.map((m) => m.body)).toEqual(["Team visits tomorrow", "Trying to post an internal note"]);
    expect(await prisma.complaintComment.count({ where: { visibility: "INTERNAL" } })).toBe(1);
  });

  it("lets neighbours support public reports once, and keeps private reports hidden", async () => {
    const owner = await makeActor("CITIZEN");
    const neighbour = await makeActor("CITIZEN");
    const pub = await createComplaint(owner, { ...input(w.wardA.id, w.cat.id), isPublic: true });
    const priv = await createComplaint(owner, input(w.wardA.id, w.cat.id));
    expect((await supportComplaint(neighbour, pub.id)).supportCount).toBe(1);
    expect((await supportComplaint(neighbour, pub.id)).supportCount).toBe(1); // idempotent
    expect(await code(supportComplaint(owner, pub.id))).toBe("422:OWN_COMPLAINT");
    expect(await code(supportComplaint(neighbour, priv.id))).toBe("404:NOT_FOUND");
    const list = await listPublicIssues(neighbour.id, { wardId: w.wardA.id, limit: 10 });
    expect(list.map((i) => i.id)).toEqual([pub.id]);
    expect(list[0]).not.toHaveProperty("reporterId");
    expect(list[0]).not.toHaveProperty("description");
    expect(list[0].supportedByMe).toBe(true);
    expect((await unsupportComplaint(neighbour, pub.id)).supportCount).toBe(0);
  });

  it("refuses attachments that belong to someone else", async () => {
    const citizen = await makeActor("CITIZEN");
    const other = await makeActor("CITIZEN");
    const att = await prisma.attachment.create({ data: { storageKey: `t/${randomUUID()}`, fileName: "x.jpg", mimeType: "image/jpeg", size: 1, purpose: "COMPLAINT", uploaderId: other.id } });
    expect(await code(createComplaint(citizen, { ...input(w.wardA.id, w.cat.id), attachmentIds: [att.id] }))).toBe("422:INVALID_ATTACHMENTS");
  });
});
