import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, noHorizontalOverflow } from "./helpers";

for (const path of ["/", "/dashboard", "/report", "/login", "/about"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await noHorizontalOverflow(page);
  });
}

test("mobile menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Open main menu/i }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("portal and admin fit small screens", async ({ page }) => {
  await login(page, ACCOUNTS.citizen, "/portal");
  await noHorizontalOverflow(page);
  await login(page, ACCOUNTS.districtAdmin, "/admin");
  await noHorizontalOverflow(page);
});
