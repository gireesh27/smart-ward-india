# Authentication: why not Clerk

**Decision (November 2026): keep Better Auth**, the open-source library already in the project, with
users, sessions and roles stored in our own PostgreSQL. Clerk was evaluated and rejected for this platform.

| Need | Clerk | Better Auth (current) |
|---|---|---|
| Citizen data hosted in India | No: Clerk states it does not offer regional data residency or region selection (US infrastructure) | Yes: wherever the database runs (Azure Central India, AWS Mumbai, Oracle Hyderabad…) |
| Works fully offline / on a laptop | No: development instances still call Clerk's hosted API | Yes: Postgres + Mailpit in Docker |
| SMS OTP for Indian numbers | Paid (Pro plan, $25/month) with "market rate" SMS outside US/Canada; only US/Canada enabled by default; no DLT template control documented | Add the phone-number plugin with any DLT-registered Indian SMS gateway (MSG91, Gupshup, AWS SNS…) |
| Roles + geographic scope (ward / local body / district / state) | Would live in user metadata or "organizations" (a paid add-on beyond 100 active organisations) | Already relational: `User.role` + `AdminScope` rows keyed to LGD codes, enforced server-side |
| Cost at scale | Free to 50,000 monthly retained users, then per-user pricing | No per-user fees |
| Lock-in | High (password hashes and sessions at Clerk) | None |

**DPDP Act 2023 / DPDP Rules 2025** (notified 13 November 2025; Consent Manager provisions from
13 November 2026; core duties such as notice, consent, security safeguards and breach intimation from
13 May 2027): the law itself does not ban transfers abroad, but government and NIC/MeitY procurement
usually expects citizen data on MeitY-empanelled cloud in India. Keeping identity data in our own
database avoids that objection entirely. *(Check the specific tender; this is procurement practice, not a statutory bar.)*

## What the platform does today

- Email + password with required email verification, password reset (30 min links), 7-day sessions.
- Roles: CITIZEN, WARD_ADMIN, DISTRICT_ADMIN, SUPER_ADMIN; scopes in `AdminScope`; every query filtered server-side (`src/lib/authz.ts`); out-of-scope records return 404.
- Deactivated users cannot start sessions; rate limits on sign-in and sensitive endpoints.

## Adding phone OTP later

1. Register as a Principal Entity on a DLT platform (TRAI TCCCPR 2018), register a header (sender ID) and an OTP content template.
2. Choose a gateway that accepts DLT entity/template IDs (MSG91, Gupshup, AWS SNS with DLT IDs).
3. Enable Better Auth's phone-number plugin and implement its `sendOTP` callback with that gateway.
4. Keep email sign-in for administrators; offer phone OTP to citizens.
