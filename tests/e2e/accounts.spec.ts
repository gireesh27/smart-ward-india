import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS } from "../../prisma/demo-accounts";
import { ORIGIN } from "./helpers";

// Signs in as every demo account (docs/ACCOUNTS.md) and opens its home area.
// The unverified and deactivated accounts must be refused.
for (const a of DEMO_ACCOUNTS) {
  test(`${a.role.toLowerCase()} ${a.email}`, async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: ORIGIN, extraHTTPHeaders: { origin: ORIGIN } });
    const res = await ctx.post("/api/auth/sign-in/email", { data: { email: a.email, password: a.password } });
    if (a.emailVerified === false || a.active === false) {
      expect(res.ok(), "this account must not be able to sign in").toBe(false);
    } else {
      expect(res.ok(), await res.text()).toBe(true);
      const home = await ctx.get(a.role === "CITIZEN" ? "/portal" : "/admin", { maxRedirects: 0 });
      expect(home.status(), `${a.email} should reach ${a.role === "CITIZEN" ? "/portal" : "/admin"}`).toBe(200);
      if (a.role === "CITIZEN") expect((await ctx.get("/admin", { maxRedirects: 0 })).status()).not.toBe(200);
    }
    await ctx.dispose();
  });
}
