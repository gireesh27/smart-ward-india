/** Public address of the site, used for canonical URLs, the sitemap and social previews (APP_URL in .env). */
export function siteUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export const SITE_NAME = "Smart Ward India";
export const SITE_DESCRIPTION =
  "Report local problems, follow their resolution and see the development score of every ward, Gram Panchayat and municipality in Andhra Pradesh.";

/** schema.org Organization and WebSite for the home page (JSON-LD), escaped for an inline script tag. */
export function siteJsonLd(c: { contactEmail: string }): string {
  const url = siteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization", "@id": `${url}/#organization`, name: SITE_NAME, url, logo: `${url}/icon-512.png`, email: c.contactEmail, description: SITE_DESCRIPTION,
        areaServed: { "@type": "State", name: "Andhra Pradesh", containedInPlace: { "@type": "Country", name: "India" } },
      },
      { "@type": "WebSite", "@id": `${url}/#website`, url, name: SITE_NAME, inLanguage: "en-IN", publisher: { "@id": `${url}/#organization` } },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
