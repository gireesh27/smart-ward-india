import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// Built per request: it lists public projects from the database, which does not exist at build time.
export const dynamic = "force-dynamic";

const PAGES: Array<{ path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/dashboard", priority: 0.9, changeFrequency: "daily" },
  { path: "/map", priority: 0.8, changeFrequency: "weekly" },
  { path: "/report", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/features", priority: 0.6, changeFrequency: "monthly" },
  { path: "/partners", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = PAGES.map((p) => ({ url: `${base}${p.path}`, lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority }));
  try {
    const projects = await prisma.project.findMany({ where: { isPublic: true, archivedAt: null }, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 });
    return [...pages, ...projects.map((p) => ({ url: `${base}/projects/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.4 }))];
  } catch {
    return pages; // database unavailable: still serve the static pages
  }
}
