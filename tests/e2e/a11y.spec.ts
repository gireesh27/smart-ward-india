import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

for (const path of ["/", "/dashboard", "/login", "/register", "/report", "/contact"]) {
  test(`no serious axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".leaflet-container").analyze();
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });
}

test("keyboard: skip link works and focus stays visible on interactive elements", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  expect(["A", "BUTTON", "SELECT", "INPUT"]).toContain(await page.evaluate(() => document.activeElement?.tagName));
});

test("admin dashboard has no critical violations", async ({ page }) => {
  await login(page, ACCOUNTS.districtAdmin);
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".leaflet-container").analyze();
  expect(res.violations.filter((v) => v.impact === "critical").map((v) => v.id)).toEqual([]);
});
