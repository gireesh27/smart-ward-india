import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_THRESHOLDS, type InsightThresholds } from "./domain/insights";
import { DEFAULT_MIN_COVERAGE } from "./domain/scoring";
import { aiStatus } from "./ai/provider";

export type SiteContent = {
  subtitle: string;
  taglineOne: string;
  taglineTwo: string;
  heroTitle: string;
  heroText: string;
  footerSlogan: string;
  contactEmail: string;
  website: string;
  location: string;
  founderName: string;
  founderTitle: string;
  founderBio: string;
};

export const DEFAULT_CONTENT: SiteContent = {
  // Switch to "AI-Powered …" in Settings → Site content once Phase 4 predictive analytics are live.
  subtitle: "AI-Ready Panchayat & Municipality Development Platform",
  taglineOne: "Every Ward Matters.",
  taglineTwo: "Every Problem Deserves Development.",
  heroTitle: "A Smarter, Stronger and More Developed India",
  heroText: "Connect Citizens, Government and Technology to Identify Problems, Anticipate Needs and Build Better Communities.",
  footerSlogan: "Understand Problems. Prioritise Development. Build Better Communities.",
  contactEmail: "info@smartwardindia.in",
  website: "www.smartwardindia.in",
  location: "Smart Ward India, Andhra Pradesh, India",
  founderName: "",
  founderTitle: "Founder & CEO",
  founderBio: "The founder's vision is to use technology and innovation to address practical development challenges faced by citizens in rural and urban India. With an educational background in Computer Science and an interest in technology entrepreneurship, the founder aims to build a scalable civic technology organisation that connects public needs with development planning for local governments across India.",
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  if (typeof fallback === "object" && fallback !== null && !Array.isArray(fallback)) {
    return { ...fallback, ...(row.value as object) } as T;
  }
  return row.value as T;
}

export async function setSetting(key: string, value: unknown, updatedById: string | null) {
  const json = value as Prisma.InputJsonValue;
  await prisma.setting.upsert({ where: { key }, create: { key, value: json, updatedById }, update: { value: json, updatedById } });
}

/**
 * Site content. The default subtitle reads "AI-Ready…" and switches to "AI-Powered…" (as in the
 * reference design) whenever an AI provider is configured, so the claim always matches the product.
 */
export async function getSiteContent(): Promise<SiteContent> {
  const c = await getSetting<SiteContent>("content.site", DEFAULT_CONTENT);
  if (/^AI-Ready\b/.test(c.subtitle) && aiStatus().available) return { ...c, subtitle: c.subtitle.replace(/^AI-Ready/, "AI-Powered") };
  return c;
}
export const getMinCoverage = () => getSetting<number>("scoring.minCoverage", DEFAULT_MIN_COVERAGE);
export const getInsightThresholds = () => getSetting<InsightThresholds>("insights.thresholds", DEFAULT_THRESHOLDS);
