import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("dashboard filters update the widgets, and exports download", async ({ page }) => {
  await login(page, ACCOUNTS.superAdmin);
  await expect(page.getByRole("heading", { name: "Smart Ward India" })).toBeVisible();
  const kpis = page.getByRole("region", { name: "Key figures" });
  const before = await kpis.textContent();
  await page.getByLabel("District", { exact: true }).selectOption({ label: "Krishna" });
  await page.waitForURL(/district=/);
  await expect(kpis).not.toHaveText(before!);

  const csv = await page.request.get("/api/reports/export?type=complaints&format=csv");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Reference");
  const pdf = await page.request.get("/api/reports/export?type=wards&format=pdf");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("insights link through to the supporting complaints", async ({ page }) => {
  await login(page, ACCOUNTS.districtAdmin, "/admin/insights");
  const link = page.getByRole("link", { name: "Open related complaints" }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/admin\/complaints\?ward=/);
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("project milestones drive progress", async ({ page }) => {
  await login(page, ACCOUNTS.superAdmin, "/admin/projects/new");
  await page.getByLabel("Project name").fill(`E2E project ${Date.now()}`);
  await page.getByLabel("Description").fill("Created by the end-to-end test suite.");
  await page.getByLabel("Budget (₹)").fill("500000");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Target date").fill("2026-12-31");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/admin\/projects\/(?!new)[^/]+$/);
  for (const t of ["Survey", "Construction"]) {
    await page.getByLabel("New milestone").fill(t);
    await page.getByRole("button", { name: "Add milestone" }).click();
    await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Mark Survey as done" }).click();
  await expect(page.getByText("50%").first()).toBeVisible();
});
