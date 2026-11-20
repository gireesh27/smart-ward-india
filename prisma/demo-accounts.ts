/**
 * Demo accounts for local testing (docs/ACCOUNTS.md). Places are referenced by their real
 * Local Government Directory names; the seed resolves them and scripts/verify-domain.ts checks
 * every reference against data/lgd/andhra-pradesh before you ever run the seed.
 * Pure module — imported by prisma/seed.ts, the domain checks and the end-to-end tests.
 */
export type DemoRole = "CITIZEN" | "WARD_ADMIN" | "DISTRICT_ADMIN" | "SUPER_ADMIN";
export type BodyRef = { district: string; localBody: string; bodyType?: "GRAM_PANCHAYAT" | "MUNICIPALITY" | "MUNICIPAL_CORPORATION" | "NAGAR_PANCHAYAT" };
export type DemoScope = ({ type: "DISTRICT"; district: string }) | ({ type: "LOCAL_BODY" } & BodyRef) | ({ type: "WARD"; ward: number } & BodyRef);
export type DemoAccount = {
  email: string; password: string; name: string; role: DemoRole;
  home?: BodyRef & { ward: number };
  scopes?: DemoScope[];
  emailVerified?: boolean;   // default true
  active?: boolean;          // default true
  purpose: string;
};

export const PASSWORDS = { super: "SuperAdmin#Demo2026", district: "District#Demo2026", ward: "WardAdmin#Demo2026", citizen: "Citizen#Demo2026" } as const;
const MC = "MUNICIPAL_CORPORATION" as const, MUN = "MUNICIPALITY" as const, GP = "GRAM_PANCHAYAT" as const;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  // ── Super administrator ──────────────────────────────────────────────────
  { email: "superadmin@smartward.test", password: PASSWORDS.super, name: "Platform Administrator", role: "SUPER_ADMIN", purpose: "Everything state-wide: users, geography, scoring, content, state-wide AI analysis" },

  // ── District administrators ──────────────────────────────────────────────
  { email: "districtadmin@smartward.test", password: PASSWORDS.district, name: "Dr. Ramesh Kumar", role: "DISTRICT_ADMIN", scopes: [{ type: "DISTRICT", district: "Krishna" }, { type: "DISTRICT", district: "NTR" }], purpose: "Two pilot districts (Krishna + NTR): full complaint, project and score data" },
  { email: "district.guntur@smartward.test", password: PASSWORDS.district, name: "Anitha Reddy", role: "DISTRICT_ADMIN", scopes: [{ type: "DISTRICT", district: "Guntur" }], purpose: "A non-pilot district: Guntur and Mangalagiri Tadepalli corporations plus sample Gram Panchayat wards" },
  { email: "district.visakhapatnam@smartward.test", password: PASSWORDS.district, name: "Srinivas Rao", role: "DISTRICT_ADMIN", scopes: [{ type: "DISTRICT", district: "Visakhapatnam" }], purpose: "Greater Visakhapatnam (98 wards) — largest corporation" },
  { email: "district.tirupati@smartward.test", password: PASSWORDS.district, name: "Padmavathi Naidu", role: "DISTRICT_ADMIN", scopes: [{ type: "DISTRICT", district: "Tirupati" }], purpose: "Tirupati district — scope isolation from the Krishna admin" },

  // ── Local-body (ward) administrators ─────────────────────────────────────
  { email: "wardadmin@smartward.test", password: PASSWORDS.ward, name: "Suresh Babu", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Krishna", localBody: "Machilipatnam Municipal Corporation", bodyType: MC }], purpose: "Machilipatnam Municipal Corporation (50 wards): triage, assign, resolve with evidence" },
  { email: "admin.vijayawada@smartward.test", password: PASSWORDS.ward, name: "Kiran Kumar", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "NTR", localBody: "Vijayawada Municipal Corporation", bodyType: MC }], purpose: "Vijayawada Municipal Corporation (64 wards)" },
  { email: "admin.gudivada@smartward.test", password: PASSWORDS.ward, name: "Bhavani Prasad", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Krishna", localBody: "Gudivada", bodyType: MUN }], purpose: "A municipality (Gudivada, 36 wards)" },
  { email: "admin.kuchipudi@smartward.test", password: PASSWORDS.ward, name: "Venkata Lakshmi", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Krishna", localBody: "Kuchipudi", bodyType: GP }], purpose: "A Gram Panchayat (Kuchipudi, 12 wards)" },
  { email: "admin.ghantasala@smartward.test", password: PASSWORDS.ward, name: "Narasimha Rao", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Krishna", localBody: "Ghantasala", bodyType: GP }], purpose: "A second Gram Panchayat (Ghantasala, 14 wards)" },
  { email: "admin.visakhapatnam@smartward.test", password: PASSWORDS.ward, name: "Sai Teja", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Visakhapatnam", localBody: "Visakhapatnam", bodyType: MC }], purpose: "Greater Visakhapatnam Municipal Corporation" },
  { email: "admin.guntur@smartward.test", password: PASSWORDS.ward, name: "Rajeswari Devi", role: "WARD_ADMIN", scopes: [{ type: "LOCAL_BODY", district: "Guntur", localBody: "Guntur", bodyType: MC }], purpose: "Guntur Municipal Corporation (57 wards)" },
  { email: "ward12.machilipatnam@smartward.test", password: PASSWORDS.ward, name: "Mohan Krishna", role: "WARD_ADMIN", scopes: [{ type: "WARD", district: "Krishna", localBody: "Machilipatnam Municipal Corporation", bodyType: MC, ward: 12 }], purpose: "Single-ward scope (Machilipatnam ward 12): sees only that ward" },

  // ── Citizens ─────────────────────────────────────────────────────────────
  { email: "citizen@smartward.test", password: PASSWORDS.citizen, name: "Lakshmi Devi", role: "CITIZEN", home: { district: "Krishna", localBody: "Machilipatnam Municipal Corporation", bodyType: MC, ward: 12 }, purpose: "Main citizen: complaints in every status, a resolution to confirm, a rejected report" },
  { email: "citizen2@smartward.test", password: PASSWORDS.citizen, name: "Ravi Teja", role: "CITIZEN", home: { district: "NTR", localBody: "Vijayawada Municipal Corporation", bodyType: MC, ward: 5 }, purpose: "Second city citizen: support neighbours' reports" },
  { email: "citizen.gudivada@smartward.test", password: PASSWORDS.citizen, name: "Prasanna Kumari", role: "CITIZEN", home: { district: "Krishna", localBody: "Gudivada", bodyType: MUN, ward: 10 }, purpose: "Municipality ward" },
  { email: "citizen.pedana@smartward.test", password: PASSWORDS.citizen, name: "Ganesh Babu", role: "CITIZEN", home: { district: "Krishna", localBody: "Pedana", bodyType: MUN, ward: 4 }, purpose: "Small municipality ward" },
  { email: "citizen.kuchipudi@smartward.test", password: PASSWORDS.citizen, name: "Sravani Kumari", role: "CITIZEN", home: { district: "Krishna", localBody: "Kuchipudi", bodyType: GP, ward: 3 }, purpose: "Gram Panchayat ward (rural)" },
  { email: "citizen.ghantasala@smartward.test", password: PASSWORDS.citizen, name: "Ramakrishna Prasad", role: "CITIZEN", home: { district: "Krishna", localBody: "Ghantasala", bodyType: GP, ward: 2 }, purpose: "Gram Panchayat ward (rural)" },
  { email: "citizen.mopidevi@smartward.test", password: PASSWORDS.citizen, name: "Durga Prasad", role: "CITIZEN", home: { district: "Krishna", localBody: "Mopidevi", bodyType: GP, ward: 3 }, purpose: "Ward with too little data: shows \"insufficient data\" instead of a score" },
  { email: "citizen.guntur@smartward.test", password: PASSWORDS.citizen, name: "Fathima Begum", role: "CITIZEN", home: { district: "Guntur", localBody: "Guntur", bodyType: MC, ward: 7 }, purpose: "Citizen outside the pilot districts" },
  { email: "citizen.visakhapatnam@smartward.test", password: PASSWORDS.citizen, name: "Harish Varma", role: "CITIZEN", home: { district: "Visakhapatnam", localBody: "Visakhapatnam", bodyType: MC, ward: 20 }, purpose: "Citizen in the largest corporation" },
  { email: "citizen.tirupati@smartward.test", password: PASSWORDS.citizen, name: "Swathi Reddy", role: "CITIZEN", home: { district: "Tirupati", localBody: "Tirupati", bodyType: MC, ward: 5 }, purpose: "Citizen in Tirupati" },
  { email: "unverified@smartward.test", password: PASSWORDS.citizen, name: "Unverified Resident", role: "CITIZEN", home: { district: "Krishna", localBody: "Machilipatnam Municipal Corporation", bodyType: MC, ward: 3 }, emailVerified: false, purpose: "Sign-in is refused until the email is verified (verification link in Mailpit)" },
  { email: "inactive@smartward.test", password: PASSWORDS.citizen, name: "Deactivated Resident", role: "CITIZEN", home: { district: "Krishna", localBody: "Machilipatnam Municipal Corporation", bodyType: MC, ward: 7 }, active: false, purpose: "Deactivated by an administrator: sign-in is refused" },
];
