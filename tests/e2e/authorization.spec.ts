import { expect, test } from "@playwright/test";
import { ACCOUNTS, ORIGIN, login } from "./helpers";

test("citizens cannot reach admin pages or another citizen's complaint", async ({ page }) => {
  await login(page, ACCOUNTS.citizen);
  const lakshmiId = (await (await page.request.get("/api/complaints")).json()).data.items[0].id as string;
  await login(page, ACCOUNTS.citizen2);
  await page.goto("/admin");
  await expect(page).toHaveURL(/portal\?notice=admin-only/);
  expect((await page.request.get("/api/dashboard")).status()).toBe(403);
  expect((await page.request.get(`/api/complaints/${lakshmiId}`)).status()).toBe(404);
});

test("ward admins cannot act outside their wards", async ({ page }) => {
  await login(page, ACCOUNTS.districtAdmin);
  const items = (await (await page.request.get("/api/complaints?pageSize=100")).json()).data.items as Array<{ id: string; ward: { localBody: { name: string } } }>;
  const outside = items.find((c) => c.ward.localBody.name.startsWith("Vijayawada"));
  test.skip(!outside, "no out-of-scope complaint in this page of results");
  await login(page, ACCOUNTS.wardAdmin);
  expect((await page.request.get(`/api/complaints/${outside!.id}`)).status()).toBe(404);
  expect((await page.request.post(`/api/complaints/${outside!.id}/status`, { headers: { Origin: ORIGIN }, data: { status: "UNDER_REVIEW" } })).status()).toBe(404);
});

test("cross-origin mutations are refused and anonymous API calls get 401", async ({ page, request }) => {
  await login(page, ACCOUNTS.citizen);
  const r = await page.request.post("/api/contact", { headers: { Origin: "https://evil.example" }, data: { name: "x", email: "x@y.z", message: "x".repeat(30) } });
  expect(r.status()).toBe(403);
  expect((await request.get("/api/complaints")).status()).toBe(401);
});
