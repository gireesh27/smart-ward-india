import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Read APP_URL when requested, not at build time (Docker images are built without it).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/api/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
