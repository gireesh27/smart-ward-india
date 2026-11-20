/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Map tiles are the only third-party origin the browser talks to. Keep this in
// sync with NEXT_PUBLIC_MAP_TILE_URL if you switch tile providers.
const tileOrigin = (() => {
  try { return new URL((process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png").replace(/\{[a-z]\}/g, "a")).origin; }
  catch { return "https://tile.openstreetmap.org"; }
})();

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-eval' only in dev for React Refresh.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${tileOrigin} https://*.tile.openstreetmap.org`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Serve uploaded photos as AVIF/WebP at the size each screen needs.
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "nodemailer", "pdf-lib"] },
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      // Boundary layers, site images and icons change rarely: let browsers and CDNs keep them for a day.
      { source: "/geo/:path*", headers: cache },
      { source: "/assets/:path*", headers: cache },
      { source: "/images/:path*", headers: cache },
      { source: "/:file(og-image.png|icon-192.png|icon-512.png|apple-icon.png|favicon.svg)", headers: cache },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
