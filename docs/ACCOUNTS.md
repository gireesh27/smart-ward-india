# Demo accounts

`npm run db:seed` creates these 25 accounts (defined in `prisma/demo-accounts.ts`). Every place is a real Local Government Directory record; `npm run verify:domain` checks each reference against `data/lgd/andhra-pradesh` and `tests/e2e/accounts.spec.ts` signs in as every account. All addresses end in `@smartward.test` and never receive real mail — in local development, mail goes to Mailpit (http://localhost:8025).

| Email | Password | Role | Area | What to test |
|---|---|---|---|---|
| `superadmin@smartward.test` | `SuperAdmin#Demo2026` | Super administrator | Whole state | Everything state-wide: users, geography, scoring, content, state-wide AI analysis |
| `districtadmin@smartward.test` | `District#Demo2026` | District administrator | Manages: Krishna district; NTR district | Two pilot districts (Krishna + NTR): full complaint, project and score data |
| `district.guntur@smartward.test` | `District#Demo2026` | District administrator | Manages: Guntur district | A non-pilot district: Guntur and Mangalagiri Tadepalli corporations plus sample Gram Panchayat wards |
| `district.visakhapatnam@smartward.test` | `District#Demo2026` | District administrator | Manages: Visakhapatnam district | Greater Visakhapatnam (98 wards) — largest corporation |
| `district.tirupati@smartward.test` | `District#Demo2026` | District administrator | Manages: Tirupati district | Tirupati district — scope isolation from the Krishna admin |
| `wardadmin@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Machilipatnam Municipal Corporation (Krishna) | Machilipatnam Municipal Corporation (50 wards): triage, assign, resolve with evidence |
| `admin.vijayawada@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Vijayawada Municipal Corporation (NTR) | Vijayawada Municipal Corporation (64 wards) |
| `admin.gudivada@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Gudivada (Krishna) | A municipality (Gudivada, 36 wards) |
| `admin.kuchipudi@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Kuchipudi (Krishna) | A Gram Panchayat (Kuchipudi, 12 wards) |
| `admin.ghantasala@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Ghantasala (Krishna) | A second Gram Panchayat (Ghantasala, 14 wards) |
| `admin.visakhapatnam@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Visakhapatnam (Visakhapatnam) | Greater Visakhapatnam Municipal Corporation |
| `admin.guntur@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Guntur (Guntur) | Guntur Municipal Corporation (57 wards) |
| `ward12.machilipatnam@smartward.test` | `WardAdmin#Demo2026` | Ward / local-body administrator | Manages: Ward 12, Machilipatnam Municipal Corporation (Krishna) | Single-ward scope (Machilipatnam ward 12): sees only that ward |
| `citizen@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 12, Machilipatnam Municipal Corporation (Krishna) | Main citizen: complaints in every status, a resolution to confirm, a rejected report |
| `citizen2@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 5, Vijayawada Municipal Corporation (NTR) | Second city citizen: support neighbours' reports |
| `citizen.gudivada@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 10, Gudivada (Krishna) | Municipality ward |
| `citizen.pedana@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 4, Pedana (Krishna) | Small municipality ward |
| `citizen.kuchipudi@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 3, Kuchipudi (Krishna) | Gram Panchayat ward (rural) |
| `citizen.ghantasala@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 2, Ghantasala (Krishna) | Gram Panchayat ward (rural) |
| `citizen.mopidevi@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 3, Mopidevi (Krishna) | Ward with too little data: shows "insufficient data" instead of a score |
| `citizen.guntur@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 7, Guntur (Guntur) | Citizen outside the pilot districts |
| `citizen.visakhapatnam@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 20, Visakhapatnam (Visakhapatnam) | Citizen in the largest corporation |
| `citizen.tirupati@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 5, Tirupati (Tirupati) | Citizen in Tirupati |
| `unverified@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 3, Machilipatnam Municipal Corporation (Krishna) | Sign-in is refused until the email is verified (verification link in Mailpit) — **cannot sign in (unverified)** |
| `inactive@smartward.test` | `Citizen#Demo2026` | Citizen | Home: Ward 7, Machilipatnam Municipal Corporation (Krishna) | Deactivated by an administrator: sign-in is refused — **cannot sign in (deactivated)** |

## Suggested test paths

1. **Citizen journey** — `citizen@smartward.test`: My complaints (every status), confirm the resolved water complaint, reopen or rate it; *Report a problem* with a photo or video; *My ward* → support a neighbour's report.
2. **Ward office** — `wardadmin@smartward.test`: triage the new complaint, assign it, resolve it with evidence; the citizen then sees *Is the problem fixed?*
3. **Scope isolation** — `admin.kuchipudi@smartward.test` sees only Kuchipudi Gram Panchayat; `ward12.machilipatnam@smartward.test` sees only Ward 12; `district.tirupati@smartward.test` never sees Krishna data (out-of-scope links return 404).
4. **District view** — `districtadmin@smartward.test`: dashboard filters (district → Panchayat/Municipality → ward), the district map, Ward Analytics comparisons, AI analysis (if configured), exports.
5. **Rural data** — `citizen.kuchipudi@smartward.test`, `citizen.ghantasala@smartward.test`; **insufficient data** — `citizen.mopidevi@smartward.test`.
6. **Outside the pilot** — `citizen.guntur@smartward.test`, `citizen.visakhapatnam@smartward.test`, `citizen.tirupati@smartward.test` (corporation wards with lighter demo activity).
7. **Refused sign-ins** — `unverified@smartward.test` (shows the verification message; the link is in Mailpit) and `inactive@smartward.test` (deactivated account).
8. **Administration** — `superadmin@smartward.test`: Settings → Users (create an account, then sign in with the emailed link in Mailpit), Geography (LGD summary), Scoring, Site content.

## Demo data behind the accounts

The seed loads all 245,030 real wards, then adds synthetic activity in three tiers:

| Tier | Local bodies | Wards | Activity |
|---|---|---|---|
| Pilot (Krishna + NTR urban bodies; Movva, Ghantasala, Mopidevi mandals) | 66 | 873 | full: complaints over 13 months, indicator readings, projects, meetings, supports |
| City (every other municipal corporation + the largest urban body of districts without one) | 25 | 1,162 | lighter complaint volume, full indicator readings |
| Sample (wards 1–2 of one Gram Panchayat in every other mandal) | 665 | 1,330 | low complaint volume, full indicator readings |

That gives development scores in all 28 districts and almost every mandal and constituency on the map. All complaint text, residents and readings are synthetic.

Create more accounts any time: as super admin in **Settings → Users**, or `npm run admin:create`.
