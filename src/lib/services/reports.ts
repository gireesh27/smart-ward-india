import type { ComplaintStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { complaintScopeWhere, type Actor } from "../authz";
import { assertAdmin } from "../authz";
import { toCsv } from "../domain/csv";
import { STATUS_LABELS, OPEN_STATUSES, isOverdue, type Status } from "../domain/status";
import { parseMonthKey } from "../domain/period";
import { renderTablePdf } from "../pdf";
import { audit } from "../audit";
import { fmtINR } from "../format";
import { wardWhere, wardPerformance, latestScorePeriod } from "./analytics";
import { COMPLAINT_SORTS } from "./complaints";
import type { z } from "zod";
import type { exportQuerySchema } from "../validation";

type Q = z.infer<typeof exportQuerySchema>;
const MAX_ROWS = 10_000;
const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : "");

type Table = { title: string; subtitle: string; columns: Array<{ header: string; weight?: number }>; rows: string[][] };

function dateRange(q: Q) {
  const from = q.from ? new Date(q.from + "T00:00:00Z") : undefined;
  const to = q.to ? new Date(new Date(q.to + "T00:00:00Z").getTime() + 86_400_000) : undefined;
  return { from, to };
}

async function complaintsTable(actor: Actor, q: Q): Promise<Table> {
  const { from, to } = dateRange(q);
  const and: Prisma.ComplaintWhereInput[] = [complaintScopeWhere(actor)];
  if (q.ward) and.push({ wardId: q.ward });
  if (q.localBody) and.push({ ward: { localBodyId: q.localBody } });
  if (q.district) and.push({ ward: { localBody: { districtId: q.district } } });
  if (q.category) and.push({ categoryId: q.category });
  if (q.status === "open") and.push({ status: { in: [...OPEN_STATUSES] as ComplaintStatus[] } });
  else if (q.status && q.status in STATUS_LABELS) and.push({ status: q.status as ComplaintStatus });
  if (from || to) and.push({ createdAt: { gte: from, lt: to } });
  const rows = await prisma.complaint.findMany({
    where: { AND: and }, orderBy: COMPLAINT_SORTS[q.sort ?? "newest"] ?? COMPLAINT_SORTS.newest, take: MAX_ROWS,
    // Exports deliberately exclude reporter identity and contact details.
    select: {
      reference: true, title: true, status: true, priority: true, severity: true, createdAt: true, dueAt: true, resolvedAt: true,
      category: { select: { name: true } }, department: { select: { name: true } },
      ward: { select: { number: true, localBody: { select: { name: true, district: { select: { name: true } } } } } },
    },
  });
  return {
    title: "Complaints report",
    subtitle: `Filters: ${describe(q)}`,
    columns: [
      { header: "Reference", weight: 1.2 }, { header: "Created", weight: 0.9 }, { header: "District", weight: 0.9 }, { header: "Local body", weight: 1.1 },
      { header: "Ward", weight: 0.5 }, { header: "Category", weight: 0.9 }, { header: "Title", weight: 2.4 }, { header: "Status", weight: 1 },
      { header: "Priority", weight: 0.7 }, { header: "Department", weight: 1.4 }, { header: "Due", weight: 0.9 }, { header: "Resolved", weight: 0.9 }, { header: "Overdue", weight: 0.6 },
    ],
    rows: rows.map((r) => [
      r.reference, d(r.createdAt), r.ward.localBody.district.name, r.ward.localBody.name, String(r.ward.number), r.category.name, r.title,
      STATUS_LABELS[r.status as Status], r.priority, r.department?.name ?? "", d(r.dueAt), d(r.resolvedAt), isOverdue(r.status as Status, r.dueAt) ? "Yes" : "No",
    ]),
  };
}

async function wardsTable(actor: Actor, q: Q): Promise<Table> {
  const month = parseMonthKey(q.month);
  const ww = wardWhere(actor, { districtId: q.district, localBodyId: q.localBody, wardId: q.ward });
  const asOf = await latestScorePeriod(ww, month);
  const perf = await wardPerformance(ww, month, asOf, MAX_ROWS, "asc");
  return {
    title: "Ward performance report",
    subtitle: `Month: ${q.month ?? "current"}; score as of ${asOf ? asOf.toISOString().slice(0, 7) : "n/a"}. ${describe(q)}`,
    columns: [
      { header: "District" }, { header: "Local body", weight: 1.3 }, { header: "Ward", weight: 0.5 }, { header: "Score", weight: 0.6 },
      { header: "Change (pts)", weight: 0.8 }, { header: "Band", weight: 1 }, { header: "Reported", weight: 0.7 }, { header: "Resolved", weight: 0.7 },
      { header: "Resolution %", weight: 0.8 }, { header: "Open now", weight: 0.7 },
    ],
    rows: perf.map((p) => [p.district, p.localBody, String(p.number), p.score?.toFixed(1) ?? "n/a", p.change?.toFixed(1) ?? "", p.band, String(p.reported), String(p.resolved), p.rate?.toFixed(1) ?? "", String(p.open)]),
  };
}

async function projectsTable(actor: Actor, q: Q): Promise<Table> {
  const rows = await prisma.project.findMany({
    where: { ward: wardWhere(actor, { districtId: q.district, localBodyId: q.localBody, wardId: q.ward }), archivedAt: null, ...(q.category ? { categoryId: q.category } : {}) },
    orderBy: { startDate: "desc" }, take: MAX_ROWS,
    include: { category: { select: { name: true } }, department: { select: { name: true } }, ward: { select: { number: true, localBody: { select: { name: true } } } } },
  });
  return {
    title: "Development projects report",
    subtitle: `Filters: ${describe(q)}`,
    columns: [
      { header: "Code", weight: 0.9 }, { header: "Project", weight: 2.2 }, { header: "Ward", weight: 1.4 }, { header: "Category", weight: 0.9 },
      { header: "Department", weight: 1.3 }, { header: "Status", weight: 0.9 }, { header: "Progress", weight: 0.6 }, { header: "Budget", weight: 0.9 },
      { header: "Spent", weight: 0.9 }, { header: "Start", weight: 0.8 }, { header: "Target", weight: 0.8 },
    ],
    rows: rows.map((p) => [p.code, p.name, `Ward ${p.ward.number}, ${p.ward.localBody.name}`, p.category.name, p.department?.name ?? "", p.status, `${p.progress}%`, fmtINR(p.budget), fmtINR(p.expenditure), d(p.startDate), d(p.targetDate)]),
  };
}

function describe(q: Q) {
  const parts = Object.entries(q).filter(([k, v]) => v && !["type", "format"].includes(k)).map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join(", ") : "none";
}

export async function buildExport(actor: Actor, q: Q, ip?: string) {
  assertAdmin(actor);
  const table = q.type === "complaints" ? await complaintsTable(actor, q) : q.type === "wards" ? await wardsTable(actor, q) : await projectsTable(actor, q);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `smart-ward-${q.type}-${stamp}.${q.format}`;
  let body: Uint8Array | string;
  if (q.format === "csv") {
    body = toCsv(table.rows, table.columns.map((c, i) => ({ header: c.header, value: (r: string[]) => r[i] })));
  } else {
    body = await renderTablePdf({ ...table, generatedBy: actor.name });
  }
  await prisma.reportExport.create({ data: { userId: actor.id, type: q.type.toUpperCase() as "COMPLAINTS" | "WARDS" | "PROJECTS", format: q.format.toUpperCase() as "CSV" | "PDF", filters: q as unknown as Prisma.InputJsonValue, rowCount: table.rows.length } });
  await audit({ actorId: actor.id, action: "report.export", entityType: "Report", summary: `${q.type} ${q.format} (${table.rows.length} rows)`, after: q, ipAddress: ip });
  return { filename, body, contentType: q.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf" };
}
