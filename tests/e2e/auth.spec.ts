import { expect, test } from "@playwright/test";
import { latestLink } from "./helpers";

test("register, verify email, sign out, reset password and sign in again", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@smartward.test`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Citizen");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("FirstPass#2026");
  await page.getByLabel("Confirm password").fill("FirstPass#2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("FirstPass#2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Verify your email before signing in")).toBeVisible();

  await page.goto(await latestLink(request, email, "verify-email"));
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: /Namaste, E2E/ })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists")).toBeVisible();
  await page.goto(await latestLink(request, email, "reset-password"));
  await page.getByLabel("New password", { exact: true }).fill("SecondPass#2026");
  await page.getByLabel("Confirm new password").fill("SecondPass#2026");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/login\?reset=1/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("SecondPass#2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal/);
});
