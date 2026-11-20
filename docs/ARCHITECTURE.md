# Architecture, design system and security

## Layers
```
Browser ── Next.js pages (server components) ──┐
        └─ client components ── fetch ── /api route handlers ──┐
                                                             ├─ src/lib/services/*  (authorisation + data access)
                                                             │      └─ src/lib/domain/* (pure rules, unit-tested)
                                                             └─ Prisma → PostgreSQL · local disk or S3 · SMTP (Mailpit) or console
```
- **Route handlers** (`src/app/api/**/route.ts`) are thin: `handler()` in `src/lib/api.ts` applies the origin check, session lookup, role gate, rate limit, Zod validation and uniform error mapping, then calls a service.
- **Services** take an `Actor` (id, role, resolved ward scope) and enforce permissions on every operation, so pages and APIs share one authorisation path. Hiding a button is never the control.
- **Domain modules** have no imports and are runnable with plain Node (`npm run verify:domain`).

## Roles and scope
| Role | Can |
|---|---|
| Citizen | Own complaints, comments, feedback, reopen requests, profile, notifications, public data |
| Ward Administrator | Complaints, projects, announcements, meetings, analytics, exports for assigned wards / local body |
| District Administrator | As above for assigned districts/state; create ward admins inside own scope; departments; inquiries |
| Super Administrator | Everything, including geography, categories, scoring, site content, any role |

`AdminScope` rows (ward / local body / district / state) are expanded to concrete ward ids per request (`resolveScope`). Public sign-up cannot set `role` (it is not an auth input; the column default is CITIZEN).

## Data model (Prisma)
Identity: `User`, `Session`, `Account`, `Verification`, `AdminScope`. Geography: `State → District → LocalBody (mandal/municipality) → Ward`. Organisation: `Department`, `StaffMember`, `Category`. Complaints: `Complaint`, `ComplaintStatusHistory`, `ComplaintComment` (PUBLIC/INTERNAL), `ComplaintAssignment`, `ComplaintFeedback`, `Attachment`. Projects: `Project`, `Milestone`, `ProjectProgressLog`. Scoring: `IndicatorDefinition`, `IndicatorReading`, `ScoreSnapshot`. `Insight`, `Notification`, `Meeting`, `MeetingParticipant`, `ActionItem`, `Announcement`, `PartnerInquiry`, `Setting` (site content + configuration), `AuditLog`, `ReportExport`, `RateLimitBucket`.
Deletion policy: operational records are archived/deactivated (projects, wards, departments, staff, users) rather than deleted; foreign keys use `Restrict` where history matters.

## Routes
Public: `/`, `/about`, `/features`, `/dashboard`, `/partners`, `/contact`, `/privacy`, `/terms`, `/report`, `/projects/:id`. Auth: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/go` (role redirect). Citizen: `/portal`, `/portal/report`, `/portal/complaints[/:id]`, `/portal/ward`, `/portal/projects`, `/portal/notifications`, `/portal/profile`. Admin: `/admin`, `/admin/analytics`, `/admin/complaints[/:id]`, `/admin/projects[/new|/:id]`, `/admin/insights`, `/admin/reports`, `/admin/tools[/meetings/:id]`, `/admin/settings?tab=…`.

## Design system (sampled from `docs/reference/*.jpg`)
| Token | Value | Use |
|---|---|---|
| navy-900 | `#002e64` | public card header bars, footer |
| navy-850 | `#011945` | admin card header bars |
| navy-800 / 950 | `#05214f` / `#03153a` | admin sidebar / canvas |
| navy-700 | `#0d3a73` | display headings |
| brand-600 / 500 | `#0059bc` / `#0066f9` | primary buttons & nav pill / admin active nav |
| saffron-500 | `#fe9a22` | “Contact Us”, focus ring |
| leaf-500 / 700 | `#41c03b` / `#12893b` | donut, success, checks |
| alert-600 | `#de0d22` | risk alerts, critical |
| tiles | water `#e1f3fd`, roads `#fee5e1`, drainage `#fde9de`, garbage `#e2f6ea`, electricity `#fdf1d9`, streetlight `#fff3dd` | category tiles |
| KPI gradients | blue `#0b4fc4→#1f74f0`, green `#0b6a33→#22a04b`, orange `#e05f05→#f99a1e`, purple `#3c1f9a→#7a45e4` | admin KPI cards |
Theming: colours that change between light and dark (surface, canvas, text, borders, tints, tiles, illustration skies) are CSS variables in `src/app/globals.css`, exposed as Tailwind colours (`bg-surface`, `text-ink-900`, …); `.dark` on `<html>` switches them. An inline script applies the saved theme before first paint; Leaflet tiles and Recharts axes follow the theme. Responsive layout: page grids change at Tailwind breakpoints (two columns from 768 px, the reference layouts from 1536 px) and card interiors use container queries (`.ward-layout`, `.split-2`, `.split-map`, `.roadmap`).

Type: Poppins (display, 600–800), Inter (UI/body), Dancing Script (two decorative captions from the admin reference). Radius 10 px on cards, 22 px on the landing feature strip; card shadow `0 2px 10px rgba(13,47,100,.10)`. Layout grids mirror the references: landing rows `345px | 1fr | 460px` and `365 | 290 | 1fr | 370`; admin rows `1.95fr 1.8fr 1fr` and `373 : 290 : 406 : 243`, sidebar 228 px.

## Security controls
- Passwords hashed by Better Auth (scrypt); sessions stored in Postgres; cookies HttpOnly, SameSite=Lax, Secure in production; sessions revoked on role change, deactivation and password change.
- Email verification required before sign-in; reset tokens single-use and expire in 30 min; verification links expire in 1 h.
- Origin-checked JSON mutations (CSRF); strict security headers + CSP in `next.config.mjs`.
- Zod validation on every input; Prisma parameterised queries; raw SQL uses tagged templates only.
- Uploads: content-signature type detection, size limits, random storage keys, private storage (local disk outside the web root, or a private bucket), per-request authorisation, sandbox CSP on downloads; SVG/HTML never accepted.
- Audit log for administrative changes (status, assignment, priority, projects, users, scoring, content, exports); logs redact emails, phones and secrets.
- Exports exclude reporter identity; public endpoints expose aggregates only.

## Geography at state scale
The hierarchy is State → District → Mandal (SubDistrict) → Local body (Gram Panchayat or urban local body) → Ward, plus Villages mapped to their Gram Panchayat, all keyed by LGD code (`docs/LGD_DATA.md`). Because Andhra Pradesh has 245,030 wards (17,797 in Srikakulam alone):
- **Admin scope is a filter, not a list.** `Scope` keeps the admin's assignments (ward/local body/district/state ids) and every query filters through relations (`wardScopeWhere`, `localBodyScopeWhere`, `districtScopeWhere`) or the SQL equivalent (`wardScopeSql`). No query ever binds an unbounded list of ward ids (PostgreSQL caps a statement at ~32,000 parameters). Single-record checks use `canAccessWard`, which looks up the ward's parents (cached for 5 minutes).
- **Analytics** aggregate with relation filters and SQL joins (`analytics.ts`): ward-level tables show the lowest-scoring wards (top N), maps aggregate per district.
- **Pickers load level by level** (`/api/geo/*`): districts → searchable local bodies (server-side search by name or mandal) → wards, plus village search ("find my Panchayat"). `?scoped=1` limits options to the admin's area.

## AI insights
`src/lib/ai/provider.ts` wraps Ollama, OpenAI-compatible and Anthropic endpoints behind one `complete()` call with timeouts and safe error messages. `ai-insights.ts` builds an aggregate, non-personal context, `domain/ai.ts` builds the prompt and validates the JSON output against the areas actually sent, and each `AiReport` stores the context and result. See `docs/AI.md`.

## UI system
shadcn/ui components (Radix primitives) in `src/components/ui/`, framer-motion for navigation and entrance animation, CSS for glass surfaces and ambient effects — see `docs/UI.md`.
