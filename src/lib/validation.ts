import { z } from "zod";
import { COMPLAINT_STATUSES } from "./domain/status";

const id = z.string().trim().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const bool = z.union([z.boolean(), z.enum(["true", "false", "on"])]).transform((v) => v === true || v === "true" || v === "on");
const isoDate = z.coerce.date();

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const complaintCreateSchema = z.object({
  wardId: id,
  categoryId: id,
  title: z.string().trim().min(5, "Use at least 5 characters").max(120),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters").max(2000),
  address: z.string().trim().min(5, "Enter the street or area").max(300),
  landmark: optionalText(120),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  severity: z.enum(SEVERITIES).default("MEDIUM"),
  attachmentIds: z.array(id).max(6).default([]),
  // Opt-in, explicit: only title, category, ward and status are ever shown to other residents.
  isPublic: z.boolean().default(false),
  idempotencyKey: z.string().uuid(),
});

export const complaintListSchema = z.object({
  q: optionalText(100),
  status: z.union([z.enum(COMPLAINT_STATUSES), z.literal("open"), z.literal("done")]).optional(),
  category: id.optional(),
  ward: id.optional(),
  localBody: id.optional(),
  district: id.optional(),
  priority: z.enum(PRIORITIES).optional(),
  overdue: z.enum(["1", "0"]).optional(),
  // Named presets or field.asc|desc; unknown values fall back to newest (see COMPLAINT_SORTS).
  sort: z.string().regex(/^[a-z]+(\.(asc|desc))?$/).max(30).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
export type ComplaintListQuery = z.infer<typeof complaintListSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  reason: optionalText(1000),
  resolutionNote: optionalText(2000),
  evidenceIds: z.array(id).max(6).default([]),
  duplicateOfReference: optionalText(20),
});

export const assignSchema = z.object({
  departmentId: id,
  staffId: id.optional().or(z.literal("").transform(() => undefined)),
  note: optionalText(500),
});

export const prioritySchema = z.object({
  priority: z.enum(PRIORITIES),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(500),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(2000),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
  attachmentIds: z.array(id).max(6).default([]),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  satisfied: bool,
  comment: optionalText(1000),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(10, "Explain what is still wrong (10+ characters)").max(1000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,15}$/, "Enter a valid phone number").optional().or(z.literal("").transform(() => undefined)),
  wardId: id.optional().or(z.literal("").transform(() => undefined)),
  notifyEmail: bool.default(false),
  notifyInApp: bool.default(false),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  organization: optionalText(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  phone: optionalText(20),
  type: z.enum(["GOVERNMENT", "CSR", "INNOVATION", "GENERAL"]).default("GENERAL"),
  message: z.string().trim().min(20, "Write at least 20 characters").max(2000),
  website: z.string().max(0, "Leave this field empty").optional(), // honeypot
});

export const projectSchema = z.object({
  name: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(4000),
  categoryId: id,
  wardId: id,
  departmentId: id.optional().or(z.literal("").transform(() => undefined)),
  budget: z.coerce.number().min(0).max(1e12),
  expenditure: z.coerce.number().min(0).max(1e12).default(0),
  startDate: isoDate,
  targetDate: isoDate,
  status: z.enum(["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNED"),
  progressMode: z.enum(["MILESTONES", "MANUAL"]).default("MILESTONES"),
  isPublic: bool.default(false),
}).refine((v) => v.targetDate >= v.startDate, { path: ["targetDate"], message: "Target date must be on or after the start date" });

export const milestoneSchema = z.object({
  title: z.string().trim().min(3).max(160),
  dueDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
  weight: z.coerce.number().int().min(1).max(10).default(1),
});

export const milestoneUpdateSchema = z.object({
  milestoneId: id,
  completed: bool,
});

export const manualProgressSchema = z.object({
  progress: z.coerce.number().int().min(0).max(100),
  note: z.string().trim().min(5, "Explain the update (5+ characters)").max(500),
});

export const meetingSchema = z.object({
  title: z.string().trim().min(4).max(160),
  agenda: z.string().trim().min(10).max(4000),
  scheduledAt: isoDate,
  durationMins: z.coerce.number().int().min(15).max(480).default(60),
  location: z.string().trim().min(2).max(200),
  districtId: id.optional().or(z.literal("").transform(() => undefined)),
  wardId: id.optional().or(z.literal("").transform(() => undefined)),
  participants: z.string().trim().max(2000).optional(), // one per line: Name <email>, role
});

export const actionItemSchema = z.object({
  description: z.string().trim().min(4).max(500),
  ownerName: z.string().trim().min(2).max(120),
  dueDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(10).max(4000),
  wardId: id.optional().or(z.literal("").transform(() => undefined)),
  districtId: id.optional().or(z.literal("").transform(() => undefined)),
  isPublished: bool.default(false),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,16}$/, "2–16 letters, digits, - or _"),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: optionalText(20),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  designation: z.string().trim().min(2).max(120),
  departmentId: id,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: optionalText(20),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/),
  icon: z.string().trim().min(2).max(30),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  slaHours: z.coerce.number().int().min(1).max(24 * 60),
  departmentId: id.optional().or(z.literal("").transform(() => undefined)),
  isActive: bool.default(false),
});

export const indicatorUpdateSchema = z.object({
  indicators: z.array(z.object({
    id,
    weight: z.coerce.number().min(0).max(100),
    target: z.coerce.number(),
    worst: z.coerce.number(),
    isActive: bool,
  })).min(1),
  minCoverage: z.coerce.number().min(0.1).max(1),
});

export const readingSchema = z.object({
  wardId: id,
  indicatorId: id,
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM"),
  value: z.coerce.number(),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["CITIZEN", "WARD_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"]),
  scopeType: z.enum(["NONE", "WARD", "LOCAL_BODY", "DISTRICT", "STATE"]).default("NONE"),
  scopeIds: z.array(id).max(200).default([]),
});

export const userUpdateSchema = z.object({
  role: z.enum(["CITIZEN", "WARD_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"]).optional(),
  isActive: bool.optional(),
  scopeType: z.enum(["NONE", "WARD", "LOCAL_BODY", "DISTRICT", "STATE"]).optional(),
  scopeIds: z.array(id).max(200).optional(),
});

export const visibilitySchema = z.object({ isPublic: z.boolean() });

export const publicIssuesSchema = z.object({
  ward: id,
  category: id.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const contentSchema = z.object({
  subtitle: z.string().trim().min(3).max(120),
  taglineOne: z.string().trim().min(3).max(80),
  taglineTwo: z.string().trim().min(3).max(80),
  heroTitle: z.string().trim().min(3).max(120),
  heroText: z.string().trim().min(3).max(300),
  footerSlogan: z.string().trim().min(3).max(140),
  contactEmail: z.string().trim().email(),
  website: z.string().trim().min(3).max(120),
  location: z.string().trim().min(3).max(120),
  founderName: z.string().trim().max(80).default(""),
  founderTitle: z.string().trim().min(2).max(80),
  founderBio: z.string().trim().min(3).max(1200),
});

export const inquiryUpdateSchema = z.object({
  status: z.enum(["NEW", "IN_REVIEW", "RESPONDED", "CLOSED"]),
  internalNote: optionalText(2000),
});

export const geoCreateSchema = z.object({
  level: z.enum(["district", "localBody", "ward"]),
  parentId: id,
  name: z.string().trim().min(2).max(120),
  code: optionalText(16),
  type: z.enum(["GRAM_PANCHAYAT", "MANDAL", "MUNICIPALITY", "MUNICIPAL_CORPORATION", "NAGAR_PANCHAYAT"]).optional(),
  number: z.coerce.number().int().min(1).max(999).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const exportQuerySchema = z.object({
  sort: z.string().regex(/^[a-z]+(\.(asc|desc))?$/).max(30).optional(),
  type: z.enum(["complaints", "wards", "projects"]),
  format: z.enum(["csv", "pdf"]),
  district: id.optional(),
  ward: id.optional(),
  localBody: id.optional(),
  category: id.optional(),
  status: z.string().max(20).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
