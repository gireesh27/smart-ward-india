# Smart Ward India — Panchayat & Municipality Development Platform

A full-stack platform where residents report local problems and follow them to resolution, ward offices manage complaints and development projects, and district officials monitor ward development scores, trends, rule-based alerts and optional AI analysis.

**Real geography:** the complete official Local Government Directory hierarchy of Andhra Pradesh — 28 districts, 688 mandals, 13,327 Gram Panchayats, 124 urban local bodies, **245,030 wards** and 17,957 villages, each with its LGD code (`docs/LGD_DATA.md`). Complaint, score and project activity in the demo is **synthetic** and limited to a Krishna/NTR pilot area.

**Independent demonstration platform. Not affiliated with any government body.**

Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · **shadcn/ui** (Radix UI, cmdk) · **Phosphor Icons** · framer-motion (navigation transitions) · PostgreSQL 16 · Prisma 5 · Better Auth · Zod · Recharts · Leaflet/OpenStreetMap · optional LLMs (**Ollama** local, OpenAI-compatible, Anthropic) · S3 or local storage · Mailpit · Vitest · Playwright.

> **Read “Verification status” at the end (and `docs/VERIFICATION.md`) before relying on this project.** The code was written in an environment without network access, so `npm install`, the build and the automated test suites were **not** run there. Your first run generates `package-lock.json` and the initial Prisma migration.

---

## 1. Prerequisites

| Software | Version | Check with |
|---|---|---|
| Node.js | **20.18 LTS** recommended (supported: ≥ 20.12 and < 23) | `node -v` |
| npm | 10 or newer (ships with Node 20) | `npm -v` |
| Docker Desktop (macOS/Windows) or Docker Engine (Linux) | 24+ with **Compose v2** | `docker compose version` |
| Git | optional | `git --version` |

Free ports needed: **3000** (app), **5432** (PostgreSQL), **1025/8025** (Mailpit) — plus **9000/9001** only if you opt into MinIO. No paid services are required for local use.

## 2. Extract and open the project

macOS / Linux:
```bash
unzip smart-ward-india.zip
cd smart-ward-india
```
Windows PowerShell:
```powershell
Expand-Archive smart-ward-india.zip -DestinationPath .
cd smart-ward-india
```

## 3. Configure environment variables

Copy the template:
```bash
cp .env.example .env            # macOS / Linux
```
```powershell
Copy-Item .env.example .env     # Windows PowerShell
```

Generate an authentication secret and paste it into `.env` as `BETTER_AUTH_SECRET=`:
```bash
openssl rand -base64 32         # macOS / Linux
```
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))   # Windows PowerShell
```

Every other value in `.env.example` already matches `docker-compose.yml` for local use:

| Variable | Purpose |
|---|---|
| `APP_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | Public URL (`http://localhost:3000` locally). Used for email links and the CSRF origin check. |
| `DATABASE_URL` | Main PostgreSQL database. |
| `TEST_DATABASE_URL` | Separate database for integration tests (created automatically by Docker). |
| `BETTER_AUTH_SECRET` | **Required.** Signs sessions and tokens. Never commit it. |
| `STORAGE_DRIVER`, `UPLOAD_DIR` | Where uploads are kept. `local` (default) writes to `./storage/uploads`; `s3` uses the `S3_*` settings. |
| `S3_*` | Only for `STORAGE_DRIVER=s3` (MinIO, AWS S3, …). `S3_CREATE_BUCKET=true` lets the app create the bucket. |
| `MAIL_TRANSPORT`, `SMTP_*`, `MAIL_FROM` | Outgoing email. `smtp` sends to Mailpit locally (nothing leaves your machine); `console` prints emails and links in the `npm run dev` terminal. |
| `UPLOAD_MAX_BYTES`, `UPLOAD_MAX_FILES` | Upload limits (default 5 MB, 6 files). |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | Map tiles (OpenStreetMap by default — demo use only). |
| `AI_SUMMARY_*` | Optional narrative summaries; leave empty. The app is fully functional without them. |

## 4. Start the infrastructure

First check that Docker can pull public images (this downloads them once):
```bash
docker pull postgres:16-alpine
docker pull axllent/mailpit:latest
```
If either command fails with `pull access denied` or a network error, see **“Docker cannot pull images”** in Troubleshooting before continuing.

Then start the services:
```bash
docker compose up -d
docker compose ps
```
`postgres` should show **healthy** and `mailpit` **running**. The Mailpit inbox is at http://localhost:8025.

Uploaded photos and documents are stored in `./storage/uploads` by default — no storage service is needed.

**Optional — S3-style storage with MinIO.** Run `docker compose --profile s3 up -d`, then set `STORAGE_DRIVER=s3` and `S3_CREATE_BUCKET=true` in `.env` (the other `S3_*` defaults already match). The app creates the private bucket on first upload. MinIO console: http://localhost:9001 (user `smartward`, password `smartward_local_only`).

## 5. Install and initialise

```bash
npm install
npx prisma migrate dev --name init --skip-seed
npm run db:seed
```
- `npm install` downloads dependencies and creates **`package-lock.json`** (commit it).
- `prisma migrate dev` creates **`prisma/migrations/<timestamp>_init/`** from the schema, applies it, and generates the Prisma client (commit the migrations folder).
- `db:seed` first **imports the real LGD hierarchy** from `data/lgd/andhra-pradesh/` (all 245,030 wards; about 30–60 s), then generates synthetic activity in three tiers — the **pilot** (873 wards: Krishna and NTR urban bodies plus Movva, Ghantasala and Mopidevi mandals), a **city** tier (every other municipal corporation and the largest urban body of districts without one: 1,162 wards) and a **sample** tier (wards 1–2 of one Gram Panchayat in every other mandal: 1,330 wards) — so all 28 districts, almost every mandal and every constituency get map data. About 35,000–40,000 complaints over 13 months, 13 months of indicator readings, projects, meetings and neighbours' supports; then scores and insight rules. It creates **25 demo accounts** (`docs/ACCOUNTS.md`). Total time 3–6 minutes. It refuses to run when `NODE_ENV=production` or against a non-local database; re-running it wipes and recreates everything.
- For a production database, load geography with the non-destructive `npm run lgd:import` instead (`docs/LGD_DATA.md`).

### Updating an existing installation

This release **removes files** (for example the old `vitest.config.ts`, now `vitest.config.mts`), so
**extract it into a new folder** rather than over the old one. Keep it outside OneDrive (e.g.
`C:\dev\smart-ward-india`). Then copy your `.env`, your `storage` folder and your `prisma/migrations`
folder from the old copy, and run:
```bash
npm install                     # this release replaces lucide-react with @phosphor-icons/react
npx prisma migrate dev          # "Already in sync" — no schema changes in this release
npm run dev
```
The database and demo accounts from the previous release keep working; re-seeding is not required.

## 6. Run the website

```bash
npm run dev
```
Keep this terminal open (Docker runs in the background). Then open:

| What | URL |
|---|---|
| Public website | http://localhost:3000 |
| Citizen portal | http://localhost:3000/portal |
| Admin dashboard | http://localhost:3000/admin |
| Email inbox (Mailpit) | http://localhost:8025 |
| Health check | http://localhost:3000/api/health |

Your own logo and photos (hero image, Vision & Mission, Partner with Us, admin sidebar) go in
`public/assets/`; until you add them the site uses its built-in artwork. See **`docs/ASSETS.md`**.

## 7. Optional: AI insights (free and local)

Rule-based alerts work without any AI. To add LLM analysis on **Insights & AI**:
```bash
docker compose --profile ai up -d
docker compose exec ollama ollama pull llama3.1:8b
```
Then in `.env` set `AI_PROVIDER=ollama`, `AI_MODEL=llama3.1:8b`, `AI_BASE_URL=http://localhost:11434` and restart `npm run dev`. OpenAI-compatible servers and Anthropic are also supported. Only aggregated, non-personal statistics are sent; see `docs/AI.md`.

## 8. Maps

Boundary layers are included (`public/geo/`): the 28 current districts, 696 mandals and 175 assembly constituencies, plus the state outline. Open **http://localhost:3000/map** for the full-screen atlas — layers, pinch/zoom, search, full screen and a details panel for any area. The dashboards embed the same map. How the layers were built and how to regenerate them: `docs/MAPS.md`.

## 9. Try the accounts and workflows

All 25 demo accounts, their passwords and what to test with each are in **`docs/ACCOUNTS.md`** (super, district, Panchayat/municipality and single-ward administrators; citizens in urban and rural wards; an unverified and a deactivated account). The most used:

**Development-only accounts** (created by the seed; they never exist in production):

| Role | Email | Password | Scope |
|---|---|---|---|
| Citizen | `citizen@smartward.test` | `Citizen#Demo2026` | Home ward: Machilipatnam Ward 12 |
| Citizen | `citizen2@smartward.test` | `Citizen#Demo2026` | Home ward: Vijayawada Ward 5 |
| Ward Administrator | `wardadmin@smartward.test` | `WardAdmin#Demo2026` | All wards of Machilipatnam Municipal Corporation |
| District Administrator | `districtadmin@smartward.test` | `District#Demo2026` | Krishna and NTR districts |
| Super Administrator | `superadmin@smartward.test` | `SuperAdmin#Demo2026` | Everything |

**Register and verify a new account**
1. Open http://localhost:3000/register and create an account.
2. Open http://localhost:8025, open the “Verify your email” message and click the link.
3. You are signed in and can use the citizen portal.

**End-to-end walkthrough**
1. Sign in as `citizen@smartward.test` → **Report an issue**. Choose Krishna → Machilipatnam → Ward 12, pick a category, write a title and details, optionally tap the map or use “Use my location”, add a photo and submit. Note the reference (e.g. `SWI-2611-…`).
2. Sign out, sign in as `wardadmin@smartward.test` → **Citizen Complaints**, search for the reference and open it.
3. **Review & assign** to a department → change status to **In progress** → choose **Resolved**, write a resolution note, upload an evidence photo, **Update status**.
4. Sign out, sign in as the citizen → open the complaint → **Is the problem fixed?** → send feedback (“Yes” closes it; otherwise use **Request reopening**). Notifications appear under the bell and in Mailpit.

**Theme and screen sizes.** Use the sun / moon / monitor switch (header, portal header, admin top bar, or the mobile menu) to choose light, dark or system theme; the choice is remembered on that device. Layouts adapt from phones to wide monitors and at any browser zoom: card contents rearrange based on the space each card actually has (CSS container queries), so nothing overlaps at 125–150 % zoom.

**Supporting reports.** Sign in as `citizen@smartward.test` → **My ward** lists open public reports from neighbours with a **Support** button. When starting a new report, choosing a ward and category shows similar open reports so residents can support one instead of filing a duplicate. Reporters choose whether neighbours can see a report (only its title, category and status are ever shown).

Also try: starting a report at http://localhost:3000/report **while signed out** (the draft, including photos, is kept on the device through sign-in); the admin dashboard filters; **Download Development Report** (PDF); **Insights → Open related complaints**; **Government Tools → Review meetings**.

## 10. Run the checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration      # needs `docker compose up -d`; uses the separate smartward_test database
npm run build
```
End-to-end tests (needs Docker services and a seeded database; starts `npm run dev` automatically if nothing is on port 3000):
```bash
npx playwright install chromium
npm run test:e2e
npx playwright show-report    # includes side-by-side screenshots vs docs/reference/*.jpg
```
A fast check that needs no database (23 checks) — business rules, uploads, AI output validation, geometry, shapefile reading, mandal-name matching, the boundary layers, the consistency of the converted LGD data, and every demo account against the LGD data:
```bash
npm run verify:domain
```

## 11. Stop, restart and reset

- Stop the app: press `Ctrl+C` in the `npm run dev` terminal.
- Stop the services (keeps data): `docker compose stop`
- Restart later: `docker compose up -d` then `npm run dev`
- Remove containers but keep data: `docker compose down`

**Reset the database (⚠ deletes all local data):**
```bash
npx prisma migrate reset --skip-seed
npm run db:seed
```
**Wipe everything including uploads (⚠ irreversible):** `docker compose down -v`, then delete the `storage` folder (`rm -rf storage` on macOS/Linux, `Remove-Item -Recurse -Force storage` in PowerShell).

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| **Docker cannot pull images** — `pull access denied`, `repository does not exist`, or several images shown as `Interrupted` | When one pull fails, `docker compose` cancels the others, so only the first error matters. Pull each image on its own (`docker pull postgres:16-alpine`, `docker pull axllent/mailpit:latest`) to find the failing one. If even `postgres:16-alpine` fails, Docker Hub is blocked or needs sign-in on your network: run `docker login`, ask IT for the company registry mirror, or skip Docker as described in the next row. |
| Using PostgreSQL without Docker | Install PostgreSQL 16 (Windows: the EDB installer from postgresql.org). In `psql` run: `CREATE USER smartward WITH PASSWORD 'smartward_local_only' CREATEDB; CREATE DATABASE smartward OWNER smartward; CREATE DATABASE smartward_test OWNER smartward;` Keep `DATABASE_URL` as in `.env.example`, set `MAIL_TRANSPORT=console` (no Mailpit needed) and keep `STORAGE_DRIVER=local`. Everything else works the same. |
| `port is already allocated` / `EADDRINUSE` | Another program uses the port. Stop it, or change the left-hand port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `.env` to match. For the app: `npm run dev -- -p 3001` and set `APP_URL`/`BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` to `http://localhost:3001`. |
| `Cannot connect to the Docker daemon` | Start Docker Desktop (or `sudo systemctl start docker`), then `docker compose up -d`. |
| `P1001: Can't reach database server` | Check `docker compose ps` shows postgres **healthy** and `DATABASE_URL` uses the right host/port. |
| Migration errors / drift warnings | For local data you can discard: `npx prisma migrate reset --skip-seed`. Never run reset against production. |
| `geo:prepare` → `ENOENT … path\to\districts.geojson` | `path/to/…` in examples is a placeholder. The layers are already included; to regenerate, use the real file paths shown in `docs/MAPS.md`. |
| `Invalid environment configuration — BETTER_AUTH_SECRET…` | `.env` is missing or the secret is shorter than 16 characters (step 3). |
| Uploads fail with a 500 error | With `STORAGE_DRIVER=local`, check the project folder is writable. With `s3`, check MinIO is running (`docker compose --profile s3 up -d`), `S3_CREATE_BUCKET=true`, and the `S3_*` values. |
| Seed says “Object storage unavailable” | Same as above; the seed still completes, only the sample photos are skipped. Re-run `npm run db:seed` after fixing it. |
| No verification email | Open http://localhost:8025. If empty, check `SMTP_HOST=localhost`, `SMTP_PORT=1025` and that `mailpit` is running — or set `MAIL_TRANSPORT=console`, restart `npm run dev`, and copy the link from that terminal. Links expire after 1 hour — use “Resend verification email” on the sign-in page. |
| “Too many requests” on sign-in | Rate limiting (5 attempts/minute). Wait a minute. |
| Map shows grey tiles | Your network blocks the tile server; ward markers still render. Set `NEXT_PUBLIC_MAP_TILE_URL` to a reachable provider. |
| `npm run build` fails fetching fonts | `next/font` downloads Google Fonts at build time; build with internet access. |

## 13. Deployment

**`docs/DEPLOYMENT.md`** has step-by-step guides. In short:
- **Free pilot**: an Oracle Cloud *Always Free* Arm VM in Hyderabad (2 OCPU, 12 GB) running `deploy/docker-compose.prod.yml` (Postgres, the app and Caddy with automatic HTTPS). GitHub Actions builds the images (`.github/workflows/deploy.yml`), so the server never pulls from Docker Hub.
- **Production**: Azure Central India (Container Apps + PostgreSQL Flexible Server) or AWS Mumbai (ECS Fargate + RDS); roughly US$80–200/month (estimate).
- Not recommended: Vercel's free Hobby plan (non-commercial use only, no database).
- Before the first deploy, commit `package-lock.json` and `prisma/migrations` (both created on your machine in step 5). The server applies the migrations on start; without them it creates the tables with `prisma db push`.
- Set `APP_URL` to the public address (for example `https://smartward.example.in`): canonical links, `sitemap.xml`, `robots.txt` and social previews use it.
- Health check: `GET /api/health`. Backups: `deploy/backup.sh`. Scaling plan: `docs/SCALING.md`. Why Better Auth rather than Clerk: `docs/AUTH.md`.

## Project layout

```
data/lgd/            LGD exports (raw/, git-ignored) and converted Andhra Pradesh CSVs + report.json
data/geo/            district headquarters coordinates for map markers
scripts/lgd/         convert.mjs (LGD .xls → CSV), import.ts / import-lib.ts (upsert into Postgres)
scripts/geo/         prepare-boundaries.ts (districts, mandals, constituencies, outline → public/geo)
public/geo/          installed boundary layers used by all maps
prisma/              schema.prisma, seed.ts, seed-assets/
src/app/(public)/    landing (reference image 1), about, features, dashboard, partners, contact, privacy, terms, report, projects/[id]
src/app/(auth)/      login, register, verify-email, forgot-password, reset-password
src/app/portal/      citizen dashboard, report, complaints, ward, projects, notifications, profile
src/app/admin/       dashboard (reference image 2), analytics, complaints, projects, insights, reports, tools, settings
src/app/api/         route handlers (see docs/API.md)
src/lib/domain/      pure business rules: lifecycle, scoring, insight rules, CSV, file checks, geometry, AI validation
src/lib/ai/          LLM provider layer (Ollama / OpenAI-compatible / Anthropic)
src/lib/services/    data-access & authorisation layer used by pages and API routes
src/components/ui/   shadcn/ui components + project primitives
src/components/      client components (GeoPicker, maps, charts), motion/, brand artwork
tests/               unit/, integration/ (real Postgres), e2e/ (Playwright)
docs/                ACCOUNTS, DEPLOYMENT, AUTH, SCALING, ASSETS, LGD_DATA, MAPS, AI, UI, VERIFICATION, API, SCORING, ARCHITECTURE, ASSETS_AND_LIMITATIONS, reference/
deploy/              docker-compose.prod.yml, Caddyfile, .env.production.example, backup.sh
.github/workflows/   ci.yml (lint, typecheck, tests, build), deploy.yml (images to GHCR, deploy over SSH)
```

## Verification status

See **`docs/VERIFICATION.md`**. In short: 23/23 domain tests pass; an offline stand-in for `npm run lint`
(checked against your original lint output) finds no errors; all 79 icon names exist in Phosphor; strict
TypeScript, syntax and import checks are clean; all 56 API routes type-check against the real Zod types (and the old typing reproduces
the errors you reported, confirming the fix); 11 browser renders show no overflow, no overlapping text and
no header collisions from 390 px to 1917 px. `npm install`, lint, the full typecheck, Vitest, Playwright,
Docker and live map/AI behaviour run on your machine (expected results listed there).
