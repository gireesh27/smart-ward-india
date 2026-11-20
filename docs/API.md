# API reference

All endpoints live under `/api`. Bodies are JSON (`Content-Type: application/json`) unless noted.

**Responses:** success → `{ "data": … }` (201 for POST, 200 otherwise). Errors → `{ "error": { "code", "message", "details" } }` with status 400/401/403/404/409/415/422/429/500. Validation errors (422) carry Zod `fieldErrors` in `details`. Records outside the caller’s scope return **404** (not 403) so their existence is not revealed.

**Authentication:** Better Auth session cookie (`better-auth.session_token`, `__Secure-` prefixed in production; HttpOnly, SameSite=Lax). Unverified or deactivated users are treated as signed out.

**CSRF:** every non-GET request must send an `Origin` header equal to `APP_URL` (browsers do this automatically). Combined with SameSite cookies and JSON-only bodies.

**Rate limits** (Postgres-backed, per IP or user): sign-in 5/min, sign-up 5/5 min, password reset 3/5 min, uploads 30/10 min, complaint creation 10/h, comments 30/10 min, contact form 5/h, exports 20/10 min, public dashboard 120/min. Exceeding returns 429 with `Retry-After`.

Auth levels: **public**, **user** (any signed-in verified user), **admin** (ward/district/super admin, further limited to geographic scope), **district+**, **super**.

## Auth (Better Auth, `/api/auth/*`)
| Method & path | Body | Notes |
|---|---|---|
| POST `/api/auth/sign-up/email` | `{ name, email, password, callbackURL }` | Always creates a **CITIZEN**; sends verification email. |
| POST `/api/auth/sign-in/email` | `{ email, password }` | 403 `EMAIL_NOT_VERIFIED` when unverified. |
| POST `/api/auth/sign-out` | — | Deletes the session row. |
| POST `/api/auth/send-verification-email` | `{ email, callbackURL }` | |
| GET `/api/auth/verify-email?token=…` | — | Single-purpose, 1-hour token; redirects to `/verify-email`. |
| POST `/api/auth/forget-password` | `{ email, redirectTo }` | Always 200 (no account enumeration). |
| POST `/api/auth/reset-password` | `{ newPassword, token }` | Token single-use, 30 min. |
| POST `/api/auth/change-password` | `{ currentPassword, newPassword, revokeOtherSessions }` | |

## Public
| Method & path | Auth | Description |
|---|---|---|
| GET `/api/health` | public | `{ status, database }`; 503 if DB unreachable. |
| GET `/api/geo` | public | State → district → local body → ward tree (active wards). |
| GET `/api/public/dashboard?district&ward&month=YYYY-MM` | public | Aggregates only: KPIs, indicators, trends, ward scores (centroids), category distribution, public projects, alert titles. No personal data, complaint coordinates or notes. |
| GET `/api/public/issues?ward&category&limit≤20` | public | Open public reports in a ward: `id, reference, title, status, createdAt, supportCount, category, mine, supportedByMe`. Never includes reporter, description, address, location or files. |
| POST `/api/contact` | public | `{ name, organization?, email, phone?, type: GENERAL|GOVERNMENT|CSR|INNOVATION, message, website(honeypot, must be empty) }` |
| GET `/api/projects?ward&status&category&q&archived&page` | public / admin | Public: public, non-archived projects. Admin: projects in scope. |
| GET `/api/projects/:id` | public / admin | Admins in scope also see internal files and logs. |

## Complaints
| Method & path | Auth | Body / query |
|---|---|---|
| GET `/api/complaints` | user | `q, status (enum|open|done), category, ward, priority, overdue=1, sort (newest|oldest|priority|due), page, pageSize`. Citizens: own complaints; admins: in scope. |
| POST `/api/complaints` | user | `{ wardId, categoryId, title(5–120), description(20–2000), address, landmark?, latitude?, longitude?, severity, attachmentIds[] (≤6, own unattached COMPLAINT uploads), idempotencyKey (uuid) }` → `{ id, reference, replayed }`. Same key returns the original complaint. |
| GET `/api/complaints/:id` | owner / admin | Citizens never receive internal notes or officials’ names. |
| POST `/api/complaints/:id/status` | owner / admin | `{ status, reason?, resolutionNote?, evidenceIds[], duplicateOfReference? }` — validated against the lifecycle (see below). |
| POST `/api/complaints/:id/assign` | admin | `{ departmentId, staffId?, note? }` — from Submitted it records Under review → Assigned. |
| POST `/api/complaints/:id/priority` | admin | `{ priority, reason }` — recalculates the due date; reason stored as an internal note + audit. |
| POST `/api/complaints/:id/comments` | owner / admin | `{ body, visibility: PUBLIC|INTERNAL (admins only), attachmentIds[] }` |
| POST `/api/complaints/:id/feedback` | owner | `{ rating 1–5, satisfied, comment? }` — only when Resolved; satisfied closes the complaint. |
| POST `/api/complaints/:id/reopen` | owner | `{ reason (≥10) }` — from Resolved, or Closed within 30 days. |
| POST · DELETE `/api/complaints/:id/support` | user (not the reporter) | Support / withdraw support for an **open, public** report (“me too”). Idempotent; returns `{ supported, supportCount }`. The reporter is notified at 1, 5, 10, 25, 50 and 100 supporters. |
| PATCH `/api/complaints/:id/visibility` | owner / admin | `{ isPublic }` — show or hide a report from other residents (admins use this for moderation; audited). |

**Lifecycle** (`src/lib/domain/status.ts`): Submitted → Under review → Assigned → In progress → Resolved → Closed. Also Rejected (reason), Duplicate (reason + original reference), Reopen requested (citizen, reason) → Reopened or Closed (admin, reason). Resolved requires a resolution note (≥10 chars) and ≥1 evidence file. Each transition records actor, time and reason; updates use optimistic concurrency (409 on conflicting edits).

## Files
| Method & path | Auth | Description |
|---|---|---|
| POST `/api/uploads` | user | `multipart/form-data`: `file`, `purpose` (COMPLAINT, COMMENT, RESOLUTION*, PROJECT_PHOTO*, PROJECT_DOCUMENT*; *admin only). Type detected from file signature: JPEG/PNG/WebP photos and MP4/MOV/WebM videos (complaints, comments, resolution evidence), PDF where allowed. Limits: `UPLOAD_MAX_BYTES` for photos/documents, `UPLOAD_MAX_VIDEO_BYTES` for videos. Returns `{ id, fileName, mimeType, size }`. Unattached uploads expire after 24 h (`npm run uploads:cleanup`). |
| GET `/api/files/:id[?download=1]` | per file | Supports `Range: bytes=…` (206 Partial Content) so videos can stream and seek. Streams from private storage after checking: public project file, uploader, complaint reporter (not internal-note files), or admin in scope. Sent with `nosniff` and a sandboxing CSP. |

## Notifications & profile
| Method & path | Auth | Body |
|---|---|---|
| GET `/api/notifications[?unread=1]` | user | `{ items, unread }` |
| POST `/api/notifications` | user | `{ ids[] }` or `{ all: true }` marks read |
| PATCH `/api/profile` | user | `{ name, phone?, wardId?, notifyEmail, notifyInApp }` |

## Administration
| Method & path | Auth | Body / notes |
|---|---|---|
| GET `/api/dashboard?state&district&localBody&ward&month&range=6|12|24` | admin | Full dashboard payload for the caller’s scope. |
| POST `/api/projects` · PUT `/api/projects/:id` | admin | `{ name, description, categoryId, wardId, departmentId?, budget, expenditure, startDate, targetDate, status, progressMode: MILESTONES|MANUAL, isPublic }` |
| POST `/api/projects/:id/archive` | admin | `{ archived: boolean }` |
| POST · PATCH `/api/projects/:id/milestones` | admin | add `{ title, dueDate?, weight }` · toggle `{ milestoneId, completed }` (recomputes progress) |
| POST `/api/projects/:id/progress` | admin | `{ progress, note }` (manual mode only, audited) |
| POST `/api/projects/:id/files` | admin | `{ attachmentIds[], isPublic }` |
| GET `/api/reports/export?type=complaints|wards|projects&format=csv|pdf&district&ward&category&status&from&to&month` | admin | File download limited to scope; excludes reporter identity; recorded in export history + audit. CSV is formula-injection safe. |
| POST · PATCH `/api/admin/insights` | admin | run rules now · `{ id, status: OPEN|ACKNOWLEDGED|DISMISSED }` |
| POST `/api/admin/insights/summary` | admin | Optional AI narrative (501 when not configured). |
| POST `/api/admin/readings` | admin | `{ wardId, indicatorId, period: YYYY-MM, value }` |
| PUT `/api/admin/scoring` | super | `{ indicators: [{ id, weight, target, worst, isActive }], minCoverage }` |
| GET · POST `/api/admin/users`, PATCH `/api/admin/users/:id` | district+ | create `{ name, email, role, scopeType: WARD|LOCAL_BODY|DISTRICT|STATE|NONE, scopeIds[] }` → setup email; update `{ role?, isActive?, scopeType?, scopeIds? }` (sessions revoked on role change/deactivation). District admins may only create ward admins within their own wards. |
| POST `/api/admin/departments` · PATCH `/:id` | district+ | `{ name, code, email?, phone? }` · `{ isActive }` |
| POST `/api/admin/staff` · PATCH `/:id` | admin | `{ name, designation, departmentId, email?, phone? }` · `{ isActive }` |
| POST `/api/admin/categories` · PUT `/:id` | super | `{ name, slug, icon, color, slaHours, departmentId?, isActive }` |
| POST `/api/admin/geo` · PATCH `/api/admin/geo/wards/:id` | super | `{ level: district|localBody|ward, parentId, name, code?, type?, number?, latitude?, longitude? }` · `{ isActive }` |
| PUT `/api/admin/content` | super | site text fields (see `contentSchema`) |
| PATCH `/api/admin/inquiries/:id` | district+ | `{ status, internalNote? }` |
| POST `/api/admin/announcements` · PATCH `/:id` | admin | `{ title, body, wardId?, districtId?, isPublished }` · `{ isPublished }` |
| GET · POST `/api/admin/meetings`, GET · PATCH `/:id`, POST · PATCH `/:id/action-items` | admin | meeting `{ title, agenda, scheduledAt, durationMins, location, districtId?, wardId?, participants (lines "Name <email>, role") }`; outcome `{ status, minutes }`; items `{ description, ownerName, dueDate? }` · `{ itemId, status }` |

## Geography (public; LGD-backed)

| Endpoint | Returns |
|---|---|
| GET `/api/geo` | States `[{ id, name, lgdCode }]` |
| GET `/api/geo/districts?state&scoped=1` | Districts with LGD code and headquarters coordinates (`scoped=1`: only the signed-in admin's area) |
| GET `/api/geo/local-bodies?district&q&limit≤2000&scoped=1` | `{ total, items: [{ id, name, type, lgdCode, subDistrict }] }` — urban bodies first, then Gram Panchayats; `q` searches names, mandal names and LGD codes |
| GET `/api/geo/wards?localBody&scoped=1` | Active wards `[{ id, number, name, nameLocal, lgdCode }]` |
| GET `/api/geo/path?ward\|localBody\|district` | The full labelled path, used to pre-fill pickers |
| GET `/api/geo/stats?layer=districts\|mandals&month` | Aggregated map statistics keyed by LGD code: average score (latest scored month), wards, local bodies, complaints this month. Cached 5 min. |
| GET `/api/geo/search?q` (≥ 2 chars) | Villages (with their Gram Panchayat, mandal and district) and local bodies matching `q`, each with a ready path |

## AI analysis (admin)

| Endpoint | Notes |
|---|---|
| GET `/api/admin/ai-insights?district` | Latest 5 reports for a district in scope (omit `district`: state-wide, super admin only) |
| POST `/api/admin/ai-insights` `{ districtId? }` | Generates a report with the configured provider; 6 per user per 10 min. 501 `AI_NOT_CONFIGURED`, 502 `AI_REQUEST_FAILED`, 504 `AI_TIMEOUT`/`AI_UNREACHABLE` |
