# Verification

Two groups of checks: those run while building this release (results below), and those you run on your
machine after `npm install` (commands and expected results at the end). Nothing in the second group was
run here: the build sandbox has no network, so no npm packages, Docker or database.

## Checks run for this release (19 November 2026)

| Check | Result |
|---|---|
| Domain tests (`npm run verify:domain`, Node test runner) | **23 passed, 0 failed** |
| Offline lint stand-in, syntax, undefined names (after the photo/chart/SEO changes) | **0 errors** (251 files) |
| Offline stand-in for `npm run lint` (the error-level rules of `next/core-web-vitals`, plus its jsx-a11y warnings) | **0 errors.** Negative control: on the older code it reports exactly your three findings (Charts.tsx 9:39 display-name, the combobox warning, the unknown `@typescript-eslint` rule). Its 3 `<img>` notices are switched off in `.eslintrc.json`, as in real ESLint. |
| Icon names | **79 of 79** exist in the Phosphor catalogue (checked against an offline copy of the full set) |
| API typing against the **real Zod 3.25 types** (all 56 `route.ts` files; Next.js/Prisma stubbed) | **0** assignability errors (the old `handler`/`parseQuery` typing reproduces your errors at the same positions) |
| Strict TypeScript over the 17 dependency-free modules and scripts | **0 errors** |
| Whole-project undefined / duplicate names (libraries stubbed) | **0** (only Node globals `process` and `Buffer`, which `@types/node` provides) |
| Syntax of 243 TS/TSX/MJS/MTS/CJS files (esbuild) | **0 errors** |
| Browser renders (headless Chromium: landing 1917/1536/1280/820/390 px and dark 1917; sign-up; admin desktop/tablet/phone) | horizontal overflow **0 px**, overlapping text **0**, header collisions **0** |
| Header height | 89 px at 1536 px and wider, 73 px at 1280 px, 57 px on tablet and phone (was about 150 px) |
| Landing page size | inline state maps simplified: page HTML about 400 KB → 135 KB, no visible change |

### This release (photos, charts, SEO, performance)
- **Photos placed as in the reference**: the hero photo fills the band behind the headline (soft wash on the left; text first on phones); Vision & Mission and Partner photos fill the right of each card and fade under the text. Checked with test photos at 1917 px, 1440 px dark and 390 px (no overflow, text readable), then removed.
- **Charts**: new reported-vs-resolved chart (bars + resolution-rate line), indicator radar and district ranking on the public dashboard; every chart, including the existing trend charts, now has *Show table* and *Download CSV* (formula-safe CSV) and series on/off buttons where there are several series. Recharts is not available offline, so these components follow the prop patterns your machine already compiles; run `npm run typecheck`.
- **SEO**: page titles and descriptions, canonical URLs, Open Graph and Twitter cards with a 1200×630 preview image, `robots.txt`, `sitemap.xml` (pages and public projects), web manifest and app icons, schema.org Organization and WebSite data on the home page. Set `APP_URL` to the public address in production.
- **Performance and smoothness**: AVIF/WebP images, one-day caching for map layers, images and icons, Telugu and script fonts no longer preloaded, loading skeletons for the dashboard, map, portal and admin, smooth in-page scrolling (off with reduced motion), balanced headings.

### What this release fixed
- **32 `tsc` errors**: `handler()`/`parseQuery()` now hand route code the schema's *output* type (`z.output`), plus small fixes for the seed id, the JSON `_note` cast, the `Uint8Array` response body, a removed destructure, `pin?.title`, Leaflet's removed `tap` option and a Recharts label.
- **3 lint findings**: named Recharts label component, `aria-controls`/`aria-expanded` on the combobox, typed AI response instead of an `eslint-disable` for a rule the config does not load.
- **`tsc` on your machine (react-leaflet types)**: `AtlasMapInner.tsx` line 255 passed an inline object to `<GeoJSON data>`, whose type is the base `GeoJsonObject`; it is now marked as a `FeatureCollection`. Confirmed with the real `@types/geojson`: the old line gives your TS2353, the new one compiles.
- **VS Code: "Cannot find module or type declarations for side-effect import of 'leaflet/dist/leaflet.css'"**: shown by TypeScript 6, which VS Code bundles and which checks side-effect imports by default (`npm run typecheck` uses the project's TypeScript 5 and never showed it). `src/types/css.d.ts` declares `.css` imports; confirmed with TypeScript 6.0.3 (error without the file, clean with it).
- **Vitest "ESM file cannot be loaded by require"**: config renamed to `vitest.config.mts` (delete an old `vitest.config.ts` if you update in place).
- **Production start**: `scripts/docker/start.sh` applies committed migrations (`prisma migrate deploy`), or creates the tables with `prisma db push` when the image has none (refuses data-loss changes).
- **CI without a lockfile**: falls back to `npm install` until `package-lock.json` is committed.
- **Tools image**: `npm run lgd:import` and `npm run admin:create` work in containers (empty `.env` in the image).
- **Look**: cartoon hero replaced by the state map (or your photo); glows removed; "A · B · C" meta lines rewritten as plain phrases.

### Harness caveats
Pages were rendered with stand-ins for icons, charts, maps, Radix and framer-motion and a Tailwind v4
compile of the project classes. Layout, spacing and collisions are reliable; exact glyphs, map tiles and
chart drawing are not shown. The offline lint is an approximation of ESLint, not ESLint itself.

## Run on your machine (expected results)

```bash
npm install
npm run lint              # expected: no errors, no warnings
npm run typecheck         # expected: 0 errors
npm run verify:domain     # 23 passed
npm run test:unit         # config loads (vitest.config.mts)
docker compose up -d && npm run test:integration
npm run build
npx playwright install chromium && npm run test:e2e   # includes the map drill-down test
```
Manual checks: header at your screen width; Profile → Appearance switches the theme (signed in, the header
has no toggle); map Auto mode (zoom in from districts to constituencies to mandals); breadcrumb returns to
the state; complaint queue column sorting and filter chips; CSV export follows the on-screen sort; the
dashed "Add your photo" notes appear in `npm run dev` only; `/api/health` returns ok.
