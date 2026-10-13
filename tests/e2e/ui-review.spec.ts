import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";

test.skip(process.env.UI_REVIEW !== "1", "Run npm run test:ui with a local development server.");

test("application layout and quick actions fit the viewport", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/ui-review");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  if ((viewport?.width ?? 1440) < 768) await expect(page.getByRole("navigation", { name: "Phone navigation" })).toBeVisible();
  const actions = page.getByRole("button", { name: "Change status for Example Company" });
  await actions.filter({ visible: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save status" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=dialog-content]")).toHaveCount(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-applications-${viewport?.width}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("job buttons and new application form fit the viewport", async ({ page, viewport }) => {
  await page.goto("/ui-review?view=jobs");
  await expect(page.getByRole("link", { name: "Log application" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-jobs-${viewport?.width}.png`),
    fullPage: true,
  });
  await page.goto("/ui-review?view=new");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("applied");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
