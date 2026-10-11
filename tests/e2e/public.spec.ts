import { expect, test } from "@playwright/test";

// These run without any Supabase credentials: they cover public pages, route protection and layout at 375/768/1440.
const PUBLIC = ["/login", "/signup", "/forgot-password", "/privacy", "/terms"];

for (const path of PUBLIC) {
  test(`${path} renders without horizontal overflow and has a main landmark`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main#main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("h1, h2, [data-slot=card-title]").first()).toBeVisible();
  });
}

test("home sends anonymous visitors to the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("privacy and terms describe real data handling", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
  await expect(page.getByText(/seven days/i).first()).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();
});

test("protected pages redirect anonymous visitors to login", async ({ page }) => {
  for (const p of ["/dashboard", "/applications", "/jobs", "/practice", "/applications/import", "/settings", "/admin/sources"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("private APIs reject anonymous callers", async ({ request }) => {
  for (const p of ["/api/export?format=csv", "/api/discovery/health", "/api/account/deletion"])
    expect((await request.get(p)).status()).toBe(401);
  const res = await request.post("/api/discovery/refresh", { headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("automatic refresh route is closed to anonymous and cross-origin callers", async ({ request }) => {
  const origin = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;
  expect((await request.post("/api/discovery/auto", { data: {}, headers: { origin } })).status()).toBe(401);
  expect((await request.post("/api/discovery/auto", { data: {}, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/discovery/auto", { data: {} })).status()).toBe(403); // no Origin header
});

test("skip link and keyboard focus reach the form on the login page", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel(/^Password/)).toBeVisible();
});

test("login form shows a generic error and preserves the email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("someone@example.test");
  await page.getByLabel(/^Password/).fill("not-a-real-password");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("someone@example.test");
});

test("signup requires accepting the terms", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByLabel(/^Password/).fill("a-long-enough-password");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByLabel(/accept the terms/i)).toBeFocused();
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  const priv = await request.get("/dashboard", { maxRedirects: 0 });
  expect(priv.headers()["cache-control"]).toContain("no-store");
});
