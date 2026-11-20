// Prompt construction and output validation for LLM insights. Pure module (no imports),
// so the rules below are unit-tested without a model or database.

export type AiArea = {
  name: string;
  kind: "district" | "mandal" | "urban";
  wards: number;
  complaints30: number;
  complaintsPrev30: number;
  open: number;
  overdue: number;
  resolutionRate: number | null;
  score: number | null;
  topCategories: string[];
};

export type AiContext = {
  scope: string;
  generatedFor: string;               // e.g. "November 2026"
  structure: { districts?: number; mandals: number; gramPanchayats: number; urbanBodies: number; wards: number; villages: number; villagesWithoutPanchayat: number };
  areas: AiArea[];
  categories: Array<{ name: string; last30: number; prev30: number; open: number; overdue: number }>;
  indicators: Array<{ name: string; score: number | null }>;
  ruleAlerts: Array<{ title: string; area: string; severity: string; summary: string }>;
  projects: { active: number; delayed: number; completed: number };
};

export type AiInsight = {
  title: string;
  area: string;
  category: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  evidence: string;
  recommendation: string;
  horizon: string;
  confidence: "low" | "medium" | "high";
};

export const AI_SYSTEM_PROMPT = [
  "You are a public-infrastructure analyst supporting Gram Panchayat, municipal and district officials in Andhra Pradesh, India.",
  "You receive ONLY aggregated statistics (no personal data) from a complaint-tracking and development-monitoring platform, with the official Local Government Directory structure.",
  "Identify recurring problems, emerging risks, under-served areas and preventive measures. Prioritise what officials can act on in the next 30–90 days.",
  "Rules: use only the numbers provided; quote them as evidence; never invent figures, places or causes; name areas exactly as given in the data;",
  "if the data is too thin to support a conclusion, say so with confidence \"low\". Respond with JSON only.",
].join(" ");

export function buildAiPrompt(ctx: AiContext, maxInsights = 6): string {
  return [
    `Scope: ${ctx.scope}. Period: ${ctx.generatedFor}.`,
    `Return a JSON object: {"insights": [ ... up to ${maxInsights} items ... ]} where each item has:`,
    `"title" (≤ 80 chars), "area" (one of the area names in the data, or "${ctx.scope}"), "category" (a category name from the data or null),`,
    `"severity" ("HIGH" | "MEDIUM" | "LOW"), "evidence" (≤ 300 chars, cite the numbers), "recommendation" (≤ 300 chars, a concrete preventive or corrective action),`,
    `"horizon" ("immediate" | "30 days" | "90 days" | "before monsoon"), "confidence" ("high" | "medium" | "low").`,
    "Order by severity, then by number of people likely affected.",
    "DATA:",
    JSON.stringify(ctx),
  ].join("\n");
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Extract the first JSON value from model output (tolerates code fences and prose around it). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("No JSON found in model output");
  const open = body[start], close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error("Unterminated JSON in model output");
}

/**
 * Validate model output against the areas and categories that were actually sent.
 * Items naming unknown areas are dropped (a common hallucination); fields are clipped.
 */
export function parseAiInsights(text: string, allowedAreas: string[], allowedCategories: string[] = [], max = 8): { insights: AiInsight[]; dropped: number; error?: string } {
  let raw: unknown;
  try { raw = extractJson(text); } catch (e) { return { insights: [], dropped: 0, error: (e as Error).message }; }
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { insights?: unknown })?.insights) ? (raw as { insights: unknown[] }).insights : null;
  if (!list) return { insights: [], dropped: 0, error: "Model output has no insights array" };
  const areaKey = new Map(allowedAreas.map((a) => [a.toLowerCase(), a]));
  const catKey = new Map(allowedCategories.map((c) => [c.toLowerCase(), c]));
  const out: AiInsight[] = [];
  let dropped = 0;
  for (const item of list) {
    if (!item || typeof item !== "object") { dropped++; continue; }
    const r = item as Record<string, unknown>;
    const area = areaKey.get(clip(r.area, 120).toLowerCase());
    const title = clip(r.title, 80), evidence = clip(r.evidence, 300), recommendation = clip(r.recommendation, 300);
    if (!area || !title || !evidence || !recommendation) { dropped++; continue; }
    const sev = clip(r.severity, 10).toUpperCase();
    const conf = clip(r.confidence, 10).toLowerCase();
    out.push({
      title, area, evidence, recommendation,
      category: catKey.get(clip(r.category, 60).toLowerCase()) ?? null,
      severity: sev === "HIGH" || sev === "MEDIUM" || sev === "LOW" ? sev : "MEDIUM",
      horizon: clip(r.horizon, 40) || "30 days",
      confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : "low",
    });
    if (out.length >= max) break;
  }
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return { insights: out.sort((a, b) => rank[a.severity] - rank[b.severity]), dropped };
}
