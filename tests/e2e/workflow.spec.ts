import { expect, test } from "@playwright/test";
import { ACCOUNTS, PNG, login, pickLocation } from "./helpers";

test("citizen reports → ward admin resolves with evidence → citizen confirms", async ({ page }) => {
  const title = `E2E burst pipe ${Date.now()}`;
  await login(page, ACCOUNTS.citizen, "/portal/report");
  await pickLocation(page, { district: "Krishna", localBody: "Machilipatnam Municipal Corporation", search: "Machili", ward: 12 });
  await page.getByLabel("Street or area").fill("3rd Cross, near Ramalayam");
  await page.getByRole("radio", { name: "Water" }).click();
  await page.getByLabel("Short title").fill(title);
  await page.getByLabel("Details").fill("A pipe has burst and water is flooding the street since early morning.");
  await page.locator('input[type="file"]').setInputFiles({ name: "pipe.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText("your complaint was submitted")).toBeVisible();
  const reference = (await page.getByRole("status").locator("strong").textContent())!.trim();

  await login(page, ACCOUNTS.wardAdmin, `/admin/complaints?q=${reference}`);
  await page.getByRole("link", { name: reference }).click();
  await page.getByRole("button", { name: "Review & assign" }).click();
  await expect(page.getByText("Assignment saved.")).toBeVisible();
  await page.getByLabel("New status").selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();
  await page.getByLabel("New status").selectOption("RESOLVED");
  await page.getByLabel("Resolution note").fill("Burst section replaced and pressure tested.");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "fixed.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("fixed.png — ready")).toBeVisible();
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();

  await login(page, ACCOUNTS.citizen, `/portal/complaints?q=${reference}`);
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: "Is the problem fixed?" })).toBeVisible();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Closed").first()).toBeVisible();
});

test("a logged-out draft with a photo survives sign-in", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/report");
  await pickLocation(page, { district: "Krishna", localBody: "Pedana", ward: 1 });
  await page.getByLabel("Street or area").fill("Main Road");
  await page.getByRole("radio", { name: "Roads" }).click();
  await page.getByLabel("Short title").fill("Draft that must survive login");
  await page.getByLabel("Details").fill("Large pothole causing accidents for two-wheelers at night.");
  await page.locator('input[type="file"]').setInputFiles({ name: "draft.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await expect(page).toHaveURL(/login.*reason=report/);
  await page.getByLabel("Email").fill(ACCOUNTS.citizen2.email);
  await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS.citizen2.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/portal\/report/);
  await expect(page.getByLabel("Short title")).toHaveValue("Draft that must survive login");
  await expect(page.getByAltText(/draft\.png/)).toBeVisible();
});
