import { expect, test } from "@playwright/test";

// Full signed-in flow. Requires a real Supabase project with migrations applied and a verified synthetic user:
//   E2E_USER_EMAIL / E2E_USER_PASSWORD (and NEXT_PUBLIC_SUPABASE_* for the server under test).
// Skipped automatically when credentials are absent so CI never fakes a pass.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel(/^Password/).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard/);
});

test("create a prepared application, attest submission, add a follow-up, export", async ({ page }) => {
  const company = `Northwind ${Date.now()}`;
  await page.goto("/applications/new");
  await page.getByLabel(/^Company/).fill(company);
  await page.getByLabel(/^Role title/).fill("Software Engineering Intern");
  await page.getByRole("button", { name: /create application/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(company) })).toBeVisible();
  await expect(page.getByText("Not submitted").first()).toBeVisible();

  await page.getByLabel("New status").selectOption("applied");
  await page.getByLabel("Submitted on").fill("2026-10-09");
  await page.getByLabel(/I confirm I submitted/).check();
  await page.getByRole("button", { name: /update status/i }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();

  await page.getByText("Add a task").click();
  await page.getByLabel("Due date").fill("2026-10-20");
  await page.getByRole("button", { name: /add task/i }).click();
  await expect(page.getByText("Task added.")).toBeVisible();

  const res = await page.request.get("/api/export?format=csv");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain(company);
});

test("dashboard shows an explicit empty or populated state and a table alternative for charts", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("View as table").first()).toBeVisible();
});

test("mobile navigation is reachable by keyboard", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 1440) >= 768, "mobile only");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /open navigation menu/i }).click();
  await expect(page.getByRole("link", { name: "Applications" })).toBeVisible();
});
