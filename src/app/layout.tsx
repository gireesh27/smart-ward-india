import type { Metadata, Viewport } from "next";
import { Poppins, Atkinson_Hyperlegible, Noto_Sans_Telugu, Dancing_Script } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/client/Toast";
import { THEME_INIT_SCRIPT } from "@/components/client/ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

// Every page reads live data; nothing is prerendered at build time.
export const dynamic = "force-dynamic";

const display = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", display: "swap" });
// Telugu and the script face are used for a few words only: not preloaded, so they never delay the first paint.
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "600", "700"], variable: "--font-telugu", display: "swap", preload: false });
const script = Dancing_Script({ subsets: ["latin"], weight: ["600"], variable: "--font-script", display: "swap", preload: false });

export function generateMetadata(): Metadata {
  const title = "Smart Ward India: Panchayat and Municipality Development Platform";
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: "%s | Smart Ward India" },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "en_IN", siteName: SITE_NAME, url: "/", title, description: SITE_DESCRIPTION, images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Smart Ward India: map of Andhra Pradesh by district" }] },
    twitter: { card: "summary_large_image", title, description: SITE_DESCRIPTION, images: ["/og-image.png"] },
    icons: { icon: "/favicon.svg", apple: "/apple-icon.png" },
    formatDetection: { telephone: false },
  };
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#002e64" }, { media: "(prefers-color-scheme: dark)", color: "#081022" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may add class="dark" before React hydrates.
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${telugu.variable} ${script.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <ToastProvider><TooltipProvider delayDuration={250}>{children}</TooltipProvider></ToastProvider>
      </body>
    </html>
  );
}
