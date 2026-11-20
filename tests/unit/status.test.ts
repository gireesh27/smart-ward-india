import { describe, expect, it } from "vitest";
import { allowedTransitions, checkTransition, computeDueAt, isOverdue, TRANSITIONS, COMPLAINT_STATUSES } from "@/lib/domain/status";

describe("complaint lifecycle", () => {
  it("allows the documented happy path", () => {
    expect(checkTransition("SUBMITTED", "UNDER_REVIEW", "ADMIN").ok).toBe(true);
    expect(checkTransition("UNDER_REVIEW", "ASSIGNED", "ADMIN", { hasAssignment: true }).ok).toBe(true);
    expect(checkTransition("ASSIGNED", "IN_PROGRESS", "ADMIN").ok).toBe(true);
    expect(checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "Valve replaced and tested", evidenceCount: 1 }).ok).toBe(true);
    expect(checkTransition("RESOLVED", "CLOSED", "CITIZEN").ok).toBe(true);
  });
  it("rejects skipped steps, terminal exits and citizen escalation", () => {
    expect(checkTransition("SUBMITTED", "RESOLVED", "ADMIN")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("REJECTED", "UNDER_REVIEW", "ADMIN")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(checkTransition("SUBMITTED", "UNDER_REVIEW", "CITIZEN")).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
    expect(checkTransition("REOPEN_REQUESTED", "REOPENED", "CITIZEN", { reason: "please reopen" })).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
  });
  it("requires evidence and a note to resolve", () => {
    expect(checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "Fixed the pipe properly", evidenceCount: 0 })).toMatchObject({ code: "MISSING_REQUIREMENT" });
    expect(checkTransition("IN_PROGRESS", "RESOLVED", "ADMIN", { resolutionNote: "ok", evidenceCount: 3 })).toMatchObject({ code: "MISSING_REQUIREMENT" });
  });
  it("requires reasons and links for rejection and duplicates", () => {
    expect(checkTransition("SUBMITTED", "REJECTED", "ADMIN", {})).toMatchObject({ code: "MISSING_REQUIREMENT" });
    expect(checkTransition("SUBMITTED", "DUPLICATE", "ADMIN", { reason: "Same pothole" })).toMatchObject({ code: "MISSING_REQUIREMENT" });
    expect(checkTransition("SUBMITTED", "DUPLICATE", "ADMIN", { reason: "Same pothole", duplicateOfId: "x" }).ok).toBe(true);
  });
  it("limits reopen requests to 30 days after closing", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    expect(checkTransition("CLOSED", "REOPEN_REQUESTED", "CITIZEN", { reason: "Still leaking badly", closedAt: new Date("2026-11-01T00:00:00Z"), now }).ok).toBe(true);
    expect(checkTransition("CLOSED", "REOPEN_REQUESTED", "CITIZEN", { reason: "Still leaking badly", closedAt: new Date("2026-09-01T00:00:00Z"), now })).toMatchObject({ code: "WINDOW_EXPIRED" });
  });
  it("defines a rule list for every status", () => {
    for (const s of COMPLAINT_STATUSES) expect(Array.isArray(TRANSITIONS[s])).toBe(true);
    expect(allowedTransitions("REJECTED", "ADMIN")).toEqual([]);
  });
  it("computes SLA due dates and overdue state", () => {
    const c = new Date("2026-11-01T00:00:00Z");
    expect(computeDueAt(c, 48, "MEDIUM").toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(computeDueAt(c, 48, "URGENT").toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(isOverdue("ASSIGNED", new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z"))).toBe(true);
    expect(isOverdue("CLOSED", new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z"))).toBe(false);
  });
});
