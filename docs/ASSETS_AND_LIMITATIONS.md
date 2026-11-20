# Asset substitutions, optional integrations and known limitations

## Asset substitutions (reference → implementation)
| Reference element | Implemented as | Why |
|---|---|---|
| Hero photograph (four residents, skyline, assembly building, village) | Your photo from `public/assets/hero/citizens.webp`; until then the Andhra Pradesh map drawn from the boundary files with the LGD coverage figures (`HeroMap.tsx`) | No licensed photography is shipped; see `docs/ASSETS.md`. |
| Logo with India map outline | Original tricolour location-pin mark (`Logo.tsx`) | Inaccurate depictions of India’s boundaries are legally sensitive. |
| Andhra Pradesh map silhouette (landing) | Hand-traced **illustrative** outline (`APOutline.tsx`), labelled “Illustrative outline, not to scale” | No licensed boundary data offline. Not an official boundary. |
| Admin district choropleth | Leaflet map with OpenStreetMap tiles and **ward-centre markers** coloured by score band | Ward boundaries unavailable; markers avoid implying official boundaries. Seeded ward centres are synthetic offsets around real town locations. |
| Road, building, faucet, project photos | Your photos from `public/assets/`; until then Phosphor duotone icons (road, government building) and category icon tiles | No licensed photos are shipped. |
| Admin skyline background photo | SVG skyline silhouette | Same. |
| Seeded complaint photos | Labelled “Synthetic placeholder” PNGs in `prisma/seed-assets/` | Demo only. |
| National flag motifs | Simplified tricolour ribbons/flag in illustrations | Review use of national symbols (Emblems and Names Act 1950, Flag Code) before public deployment. |

## Wording changes from the references
- “AI-Powered … Platform” → “AI-Ready …” by default (switch to “AI-Powered” in Settings → Site content once Phase 4 predictive analytics are live); “AI Insights & Predictions” → “Insights & Risk Alerts”; “Next 3 Months: High risk…” → “Watch now: rising water complaints in N wards … Rule-based, not a forecast”; “Generate AI Report” → “Generate Insight Report”. Insights are deterministic rules, so predictive claims were removed. All public header/hero/footer text is editable in **Settings → Site content**.
- Development score change is shown in **points** (e.g. “+3.2 pts”), not percent, because it is an absolute change on a 0–100 scale.
- “Serving 1.4+ Crore Citizens” footer text replaced by a non-numeric statement (no verified population figure).

## Optional integrations
- **AI narrative summaries** — set `AI_SUMMARY_PROVIDER=anthropic`, `AI_SUMMARY_API_KEY`, optionally `AI_SUMMARY_MODEL`. Only aggregated alert text is sent. Without it, the button explains that it is not configured.
- **Map tiles** — any XYZ tile provider via `NEXT_PUBLIC_MAP_TILE_URL` (update CSP and attribution).
- **Storage** — local disk by default (`STORAGE_DRIVER=local`) or any S3-compatible service; MinIO is an optional compose profile.
- **Email** — any SMTP provider; Mailpit locally, or `MAIL_TRANSPORT=console` to print emails during development.

## Known limitations
1. **Not executed end to end in the build environment** (no network): dependency install, type-check, lint, build, Vitest/Playwright suites, seed, Docker and screenshot comparison were not run. Domain rules, syntax, import wiring and the PDF renderer were verified. Expect minor fixes on first run.
2. **Lockfile and initial migration** are generated on your first `npm install` / `prisma migrate dev`; commit both.
3. **Better Auth version** pinned to `~1.2.7` for a known API (`forgetPassword`, `signUpEmail`). Newer major versions rename some methods.
4. **Email verification tokens** are Better Auth’s signed, 1-hour tokens; re-using one after verification has no further effect but is not strictly single-use. Password-reset tokens are single-use.
5. **PDF exports** use Helvetica: non-Latin scripts (e.g. Telugu) render as “?”, ₹ as “Rs.”. Embed a Unicode font (pdf-lib + fontkit) for multilingual PDFs. CSV exports keep full Unicode.
6. **No ward boundary polygons**; maps use centre markers. Import licensed GeoJSON to add boundaries.
7. **Notifications** are in-app (polled every minute) and email; no SMS/push.
8. **Times** display in IST; meeting `datetime-local` inputs are interpreted in the server’s time zone (set `TZ=Asia/Kolkata` in production).
9. **English only** UI; no Telugu/Hindi translations yet.
10. **Visual fidelity** is approximated in code from the references; the Playwright visual spec attaches screenshots next to the references for review rather than asserting pixel equality.
12. **Videos** are stored as uploaded, not transcoded: MOV files from iPhones play in Safari and most Chrome builds but not every browser. Add server-side transcoding (e.g. FFmpeg to MP4/H.264) before a wide rollout.
13. **Indicator data sources** (UDISE+, MGNREGA, etc.) are named as intended sources; values in the demo are synthetic. Real integration needs data-sharing agreements.
11. Admin-created accounts and the seed call Better Auth’s server API; if a future Better Auth release changes `auth.api.signUpEmail` / `forgetPassword`, update `src/lib/services/users.ts`, `scripts/create-admin.ts` and `prisma/seed.ts`.

## Geography, maps and AI (this release)
- **Geography is real** (LGD, November 2026 exports); complaint, score, project and meeting data is synthetic and exists only for the Krishna/NTR pilot area. Other wards show "insufficient data".
- **Boundaries** come from the supplied district, mandal and constituency files (districts rebuilt from mandals for the 28 current districts) plus a Survey of India reference outline that predates 2014. 7 of 688 LGD mandals have no shape yet; constituency scores are approximate (mandal centres). Confirm licences before public use (`docs/MAPS.md`).
- **AI output is advice**, generated from aggregates, validated against known area names and stored with its inputs, but it can still be wrong; small local models occasionally return unusable output.
- **"Aceternity-style"** effects are original implementations of those design patterns, not copied Aceternity components.

- **Demo data tiers**: complaints and readings exist for 3,365 of 245,030 wards (pilot, city and sample tiers, `docs/ACCOUNTS.md`); everything else shows "no data yet".
