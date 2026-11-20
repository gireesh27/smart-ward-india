// Complaint lifecycle rules. Pure module: no imports, safe to run anywhere.

export const COMPLAINT_STATUSES = [
  "SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED",
  "CLOSED", "REJECTED", "DUPLICATE", "REOPEN_REQUESTED", "REOPENED",
] as const;
export type Status = (typeof COMPLAINT_STATUSES)[number];
export type ActorKind = "CITIZEN" | "ADMIN" | "SYSTEM";
export type Requirement = "reason" | "resolution" | "duplicateOf" | "assignment";

export const OPEN_STATUSES: readonly Status[] = [
  "SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "REOPEN_REQUESTED", "REOPENED",
];
export const DONE_STATUSES: readonly Status[] = ["RESOLVED", "CLOSED"];
export const TERMINAL_STATUSES: readonly Status[] = ["REJECTED", "DUPLICATE"];

export const STATUS_LABELS: Record<Status, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  DUPLICATE: "Duplicate",
  REOPEN_REQUESTED: "Reopen requested",
  REOPENED: "Reopened",
};

type Rule = { to: Status; by: ActorKind[]; requires?: Requirement[] };

export const TRANSITIONS: Record<Status, Rule[]> = {
  SUBMITTED: [
    { to: "UNDER_REVIEW", by: ["ADMIN"] },
    { to: "REJECTED", by: ["ADMIN"], requires: ["reason"] },
    { to: "DUPLICATE", by: ["ADMIN"], requires: ["reason", "duplicateOf"] },
  ],
  UNDER_REVIEW: [
    { to: "ASSIGNED", by: ["ADMIN"], requires: ["assignment"] },
    { to: "REJECTED", by: ["ADMIN"], requires: ["reason"] },
    { to: "DUPLICATE", by: ["ADMIN"], requires: ["reason", "duplicateOf"] },
  ],
  ASSIGNED: [
    { to: "IN_PROGRESS", by: ["ADMIN"] },
    { to: "UNDER_REVIEW", by: ["ADMIN"], requires: ["reason"] },
  ],
  IN_PROGRESS: [
    { to: "RESOLVED", by: ["ADMIN"], requires: ["resolution"] },
    { to: "ASSIGNED", by: ["ADMIN"], requires: ["reason", "assignment"] },
  ],
  RESOLVED: [
    { to: "CLOSED", by: ["ADMIN", "CITIZEN", "SYSTEM"] },
    { to: "REOPEN_REQUESTED", by: ["CITIZEN"], requires: ["reason"] },
  ],
  CLOSED: [{ to: "REOPEN_REQUESTED", by: ["CITIZEN"], requires: ["reason"] }],
  REOPEN_REQUESTED: [
    { to: "REOPENED", by: ["ADMIN"], requires: ["reason"] },
    { to: "CLOSED", by: ["ADMIN"], requires: ["reason"] },
  ],
  REOPENED: [
    { to: "ASSIGNED", by: ["ADMIN"], requires: ["assignment"] },
    { to: "IN_PROGRESS", by: ["ADMIN"], requires: ["assignment"] },
  ],
  REJECTED: [],
  DUPLICATE: [],
};

/** Citizens may ask to reopen a closed complaint for this many days. */
export const REOPEN_WINDOW_DAYS = 30;
export const MIN_REASON_LENGTH = 5;
export const MIN_RESOLUTION_NOTE_LENGTH = 10;

export type TransitionContext = {
  reason?: string | null;
  resolutionNote?: string | null;
  evidenceCount?: number;
  duplicateOfId?: string | null;
  hasAssignment?: boolean;
  closedAt?: Date | null;
  now?: Date;
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_TRANSITION" | "NOT_PERMITTED" | "MISSING_REQUIREMENT" | "WINDOW_EXPIRED"; message: string };

export function allowedTransitions(from: Status, actor: ActorKind): Status[] {
  return TRANSITIONS[from].filter((r) => r.by.includes(actor)).map((r) => r.to);
}

export function checkTransition(from: Status, to: Status, actor: ActorKind, ctx: TransitionContext = {}): TransitionResult {
  const rule = TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) {
    return { ok: false, code: "INVALID_TRANSITION", message: `A complaint cannot move from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.` };
  }
  if (!rule.by.includes(actor)) {
    return { ok: false, code: "NOT_PERMITTED", message: `You are not allowed to mark this complaint as ${STATUS_LABELS[to].toLowerCase()}.` };
  }
  for (const req of rule.requires ?? []) {
    if (req === "reason" && (ctx.reason ?? "").trim().length < MIN_REASON_LENGTH) {
      return { ok: false, code: "MISSING_REQUIREMENT", message: `Give a reason of at least ${MIN_REASON_LENGTH} characters.` };
    }
    if (req === "resolution") {
      if ((ctx.resolutionNote ?? "").trim().length < MIN_RESOLUTION_NOTE_LENGTH) {
        return { ok: false, code: "MISSING_REQUIREMENT", message: `Describe the resolution in at least ${MIN_RESOLUTION_NOTE_LENGTH} characters.` };
      }
      if ((ctx.evidenceCount ?? 0) < 1) {
        return { ok: false, code: "MISSING_REQUIREMENT", message: "Attach at least one photo or document as resolution evidence." };
      }
    }
    if (req === "duplicateOf" && !ctx.duplicateOfId) {
      return { ok: false, code: "MISSING_REQUIREMENT", message: "Link the original complaint this one duplicates." };
    }
    if (req === "assignment" && !ctx.hasAssignment) {
      return { ok: false, code: "MISSING_REQUIREMENT", message: "Assign a department before moving this complaint forward." };
    }
  }
  if (from === "CLOSED" && to === "REOPEN_REQUESTED" && ctx.closedAt) {
    const now = ctx.now ?? new Date();
    const ageDays = (now.getTime() - ctx.closedAt.getTime()) / 86_400_000;
    if (ageDays > REOPEN_WINDOW_DAYS) {
      return { ok: false, code: "WINDOW_EXPIRED", message: `Complaints can only be reopened within ${REOPEN_WINDOW_DAYS} days of closing. Submit a new complaint instead.` };
    }
  }
  return { ok: true };
}

export type PriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
const PRIORITY_SLA_FACTOR: Record<PriorityValue, number> = { LOW: 1.5, MEDIUM: 1, HIGH: 0.75, URGENT: 0.5 };

export function computeDueAt(createdAt: Date, slaHours: number, priority: PriorityValue): Date {
  return new Date(createdAt.getTime() + Math.round(slaHours * PRIORITY_SLA_FACTOR[priority]) * 3_600_000);
}

export function isOverdue(status: Status, dueAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !!dueAt && OPEN_STATUSES.includes(status) && dueAt.getTime() < now.getTime();
}

export function severityToPriority(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"): PriorityValue {
  return ({ LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "URGENT" } as const)[severity];
}
