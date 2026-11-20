import { expect, test } from "@playwright/test";

test("LGD geography: villages lead to their Gram Panchayat; districts list all 28", async ({ page, request }) => {
  const states = await (await request.get("/api/geo")).json();
  expect(states.data.map((s: { name: string }) => s.name)).toContain("Andhra Pradesh");
  const districts = await (await request.get(`/api/geo/districts?state=${states.data[0].id}`)).json();
  expect(districts.data).toHaveLength(28);

  const hits = await (await request.get("/api/geo/search?q=Kuchipudi")).json();
  expect(hits.data.some((h: { label: string; path: { district: { name: string } } }) => h.label === "Kuchipudi" && h.path.district.name === "Krishna")).toBe(true);

  await page.goto("/report");
  await page.getByLabel(/Find by village or town/).fill("Kuchipudi");
  await page.getByRole("option", { name: /Kuchipudi/ }).first().click();
  await expect(page.getByLabel("Panchayat / Municipality")).toContainText("Kuchipudi");
  await expect(page.getByLabel("Ward", { exact: true })).toBeEnabled();
});

test("map page: layers switch, zoom controls and details panel", async ({ page }) => {
  await page.goto("/map");
  const tabs = page.getByRole("tablist", { name: "Map layer" });
  await expect(tabs.getByRole("tab", { name: /^Auto \(Districts\)/ })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Mandals" }).click();
  await expect(tabs.getByRole("tab", { name: "Mandals" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Show all of Andhra Pradesh" }).click();
  await tabs.getByRole("tab", { name: "Districts", exact: true }).click();
  await page.getByLabel("Search Districts").fill("Krishna");
  await page.getByRole("button", { name: /^Krishna/ }).click();
  await expect(page.getByRole("dialog", { name: /Krishna details/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Map location" })).toContainText("Krishna");
  const geo = await (await page.request.get("/geo/andhra-pradesh-districts.geojson")).json();
  expect(geo.features).toHaveLength(28);
});
