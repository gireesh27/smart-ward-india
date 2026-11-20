import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { DEMO_ACCOUNTS } from "../../prisma/demo-accounts";

// Single source of truth: prisma/demo-accounts.ts (also used by the seed and verify:domain).
const account = (email: string) => { const a = DEMO_ACCOUNTS.find((x) => x.email === email); if (!a) throw new Error(`Unknown demo account ${email}`); return { email: a.email, password: a.password }; };
export const ACCOUNTS = {
  citizen: account("citizen@smartward.test"),
  citizen2: account("citizen2@smartward.test"),
  wardAdmin: account("wardadmin@smartward.test"),
  districtAdmin: account("districtadmin@smartward.test"),
  superAdmin: account("superadmin@smartward.test"),
};
export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export async function login(page: Page, who: { email: string; password: string }, next = "/go") {
  await page.context().clearCookies();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Newest link containing `contains` sent to `to`, read through the Mailpit API. */
export async function latestLink(request: APIRequestContext, to: string, contains: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
    for (const m of list.messages ?? []) {
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const link = String(msg.Text ?? "").split(/\s+/).find((t: string) => t.startsWith("http") && t.includes(contains));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email containing "${contains}" for ${to}`);
}

/** 2×2 PNG used for upload tests. */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==", "base64");

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Drive the cascading GeoPicker: District (select) → Panchayat/Municipality (search combobox) → Ward (select). */
export async function pickLocation(page: Page, o: { district: string; localBody: string; ward: number; search?: string }) {
  const district = page.getByLabel("District", { exact: true });
  await expect(district).toBeEnabled();
  await district.selectOption({ label: o.district });
  await page.getByLabel("Panchayat / Municipality").click();
  await page.getByPlaceholder(/Type a Panchayat/).fill(o.search ?? o.localBody);
  await page.getByRole("option", { name: new RegExp(`^${o.localBody.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first().click();
  await page.getByLabel("Ward", { exact: true }).selectOption({ label: `Ward No. ${o.ward}` });
}
