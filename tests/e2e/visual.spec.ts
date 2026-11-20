import { readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/**
 * Captures both primary screens at the reference sizes and attaches them beside
 * docs/reference/*.jpg in the HTML report (npx playwright show-report) for
 * side-by-side review. Not a pixel assertion: reference photography was
 * replaced with original illustrations (see docs/ASSETS_AND_LIMITATIONS.md).
 */
test("landing page vs reference (1536×1024)", async ({ page }, info) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await info.attach("actual-landing", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("reference-landing", { body: readFileSync("docs/reference/landing-reference.jpg"), contentType: "image/jpeg" });
});

test("admin dashboard vs reference (1600×900)", async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page, ACCOUNTS.districtAdmin, "/admin");
  await page.waitForLoadState("networkidle");
  await info.attach("actual-admin", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("reference-admin", { body: readFileSync("docs/reference/admin-reference.jpg"), contentType: "image/jpeg" });
});
