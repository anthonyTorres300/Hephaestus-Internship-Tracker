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

test("practice recommendations personalize picks and keep profile details compact", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review?view=practice");
  const picks = page.getByRole("list", { name: "Top recommended problems" });
  await expect(picks.getByRole("listitem")).toHaveCount(3);
  await expect(picks.getByRole("listitem").first()).toContainText("Review due");
  await expect(page.getByRole("list", { name: "More recommended problems" })).toBeHidden();
  await page.getByText("3 more suggestions", { exact: true }).click();
  await expect(page.getByRole("list", { name: "More recommended problems" })).toBeVisible();
  await page.getByLabel("Topic focus").selectOption("trees-bst");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("hard");
  await expect(picks).toContainText("Trees / BST");
  for (const pick of await picks.getByRole("listitem").all()) await expect(pick).toContainText(/hard/i);
  await page.getByLabel("Topic focus").selectOption("sliding-window");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("easy");
  await expect(page.getByText("No suitable picks for this combination.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(picks.getByRole("listitem").first()).toContainText("Review due");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-practice-${viewport?.width}.png`),
    fullPage: true,
  });
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeHidden();
  await page.getByText("Activity & profile details", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top topics" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-practice-expanded-${viewport?.width}.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log attempt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Difficulty", { exact: true })).toHaveValue("easy");
  await expect(dialog.getByLabel("Arrays / Hash Maps")).toBeChecked();
  await expect(dialog.getByLabel("Problem title")).toHaveValue("Two Sum");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("study plans support topic exploration, zoom, search and shared progress", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review?view=practice");
  const progress = page.getByRole("progressbar", { name: "Blind 75 progress" });
  await expect(progress).toHaveAttribute("aria-valuemax", "75");
  await expect(progress).toHaveAttribute("aria-valuenow", "3");
  const graph = page.getByRole("region", { name: "Interactive topic roadmap" });
  await expect(graph.getByRole("button")).toHaveCount(18);
  await page.getByRole("button", { name: "Zoom in roadmap", exact: true }).click();
  await expect(page.getByText("95%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset roadmap zoom" }).click();
  await expect(page.getByText("85%", { exact: true })).toBeVisible();
  await graph.getByRole("button", { name: "Stack: 1 of 1 solved", exact: true }).click();
  const panel = page.locator("#study-topic-panel");
  await expect(panel.getByRole("heading", { name: "Stack", exact: true })).toBeVisible();
  await expect(panel.getByText("Valid Parentheses", { exact: true })).toBeVisible();
  await page.getByLabel("Show remaining only").check();
  await expect(panel.getByText("All problems in this topic are solved.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "NeetCode 150", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "NeetCode 150 progress" })).toHaveAttribute("aria-valuemax", "150");
  await expect(page.getByRole("progressbar", { name: "NeetCode 150 progress" })).toHaveAttribute("aria-valuenow", "3");
  await page.getByLabel("Show remaining only").uncheck();
  await page.getByLabel("Search this topic").fill("min stack");
  await expect(panel.getByRole("listitem")).toHaveCount(1);
  await expect(panel.getByRole("link", { name: "Log study attempt for Min Stack" })).toHaveAttribute("href", "/practice?log=min-stack");
  await page.getByLabel("Search this topic").fill("does not exist");
  await expect(panel.getByText("No problems match that search.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Topics", exact: true }).click();
  const topics = page.getByRole("group", { name: "Study topics" });
  await expect(topics.getByRole("button")).toHaveCount(18);
  await topics.getByRole("button", { name: "Arrays & Hashing: 1 of 9 solved", exact: true }).click();
  await page.getByLabel("Search this topic").fill("encode");
  await expect(panel.getByRole("link", { name: "Alternate practice", exact: false })).toHaveAttribute(
    "href",
    "https://www.lintcode.com/problem/659/",
  );
  await expect(panel.getByRole("link", { name: "Walkthrough", exact: false })).toHaveAttribute(
    "href",
    /^https:\/\/www.youtube.com\/watch\?v=/,
  );
  await page.getByLabel("Search this topic").fill("");
  await page.getByRole("button", { name: "Roadmap", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-study-plans-${viewport?.width}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("logged attempts open their own notes and details, including older history", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review?view=practice");
  const attempts = page.getByRole("list", { name: "Logged attempts", exact: true });
  await expect(attempts.getByRole("listitem")).toHaveCount(6);
  const first = attempts.getByRole("button", { name: /^View attempt for Two Sum/ }).first();
  await first.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Two Sum", exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Two Sum", exact: true })).toBeInViewport();
  await expect(dialog.getByText("Solved with hints", { exact: true })).toBeVisible();
  await expect(dialog.getByText("0 min", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3/5", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Python", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Oct 20, 2026", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Arrays / Hash Maps", { exact: true })).toBeVisible();
  const notes = dialog.getByRole("region", { name: "Attempt notes" });
  await expect(notes).toContainText("Used a hash map.\nTime complexity: O(n).");
  await expect(notes).toContainText("<script>alert('notes')</script>");
  await expect(notes.locator("script")).toHaveCount(0);
  await expect(notes.locator("p")).toHaveCSS("white-space", "pre-wrap");
  await expect(dialog.getByRole("link", { name: "Open problem", exact: false })).toHaveAttribute(
    "href",
    "https://leetcode.com/problems/two-sum/",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const popup = page.locator("[data-slot=dialog-content]");
  expect(await popup.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-attempt-notes-${viewport?.width}.png`),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
  await attempts
    .getByRole("button", { name: /^View attempt for Two Sum/ })
    .nth(1)
    .click();
  await expect(dialog.getByText("No notes saved for this attempt.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Not rated", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Not scheduled", { exact: true })).toBeVisible();
  await expect(dialog.getByText("No topics recorded", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText("Used a hash map.");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Older attempts", exact: true }).click();
  await expect(attempts.getByRole("listitem")).toHaveCount(1);
  await attempts.getByRole("button", { name: /^View attempt for Older logged problem/ }).click();
  await expect(dialog.getByRole("heading", { name: "Older logged problem", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Newer attempts", exact: true }).click();
  await expect(attempts.getByRole("listitem")).toHaveCount(6);
  await expect(attempts.locator("[data-slot=dialog-trigger] button")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("global Quick Log restores drafts, reviews posting suggestions and supports batch entry", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/applications/duplicates", (route) =>
    route.fulfill({
      json: {
        duplicates: route.request().postDataJSON().application_url?.includes("already")
          ? [
              {
                id: "00000000-0000-4000-8000-000000000001",
                company_name: "Already logged",
                role_title: "SWE Intern",
                status: "applied",
                reason: "Same application link",
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/applications/prefill", (route) =>
    route.fulfill({
      json: {
        suggestion: { company_name: "Northwind", role_title: "Backend Intern", locations: ["San Juan, PR"], requisition_id: "REQ-42" },
      },
    }),
  );
  await page.goto("/ui-review?view=practice");
  const before = page.url();
  // A click is replayed during hydration; the native keyboard listener is verified after that first interactive render.
  await page.getByRole("button", { name: "Quick log application", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Quick Log", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=dialog-content]")).toHaveCount(0);
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Quick Log", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Company", { exact: false }).fill("Draft Company");
  await dialog.getByLabel("Role title", { exact: false }).fill("Draft Role");
  await dialog.getByLabel("Submitted on", { exact: false }).fill("2026-10-09");
  await dialog.getByText("More details (priority, links, location, season)", { exact: true }).click();
  await dialog.getByLabel("Season", { exact: true }).selectOption("__new");
  await dialog.getByLabel("Season year", { exact: true }).fill("2028");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Quick log application", exact: true }).click();
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue("Draft Company");
  await expect(dialog.getByLabel("Role title", { exact: false })).toHaveValue("Draft Role");
  await expect(dialog.getByText("Draft restored from this browser.", { exact: true })).toBeVisible();
  await dialog.getByText("More details (priority, links, location, season)", { exact: true }).click();
  await expect(dialog.getByLabel("Season", { exact: true })).toHaveValue("__new");
  await expect(dialog.getByLabel("Season year", { exact: true })).toHaveValue("2028");
  await dialog.getByLabel("Season", { exact: true }).selectOption("summer:2027");
  await dialog.getByText("More details (priority, links, location, season)", { exact: true }).click();
  await dialog.getByLabel("Job posting link", { exact: false }).fill("https://jobs.example.com/jobs/123");
  await dialog.getByRole("button", { name: "Suggest details from link", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Review suggestions" })).toBeVisible();
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue("Draft Company");
  await dialog.getByRole("button", { name: "Use these suggestions", exact: true }).click();
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue("Northwind");
  await expect(dialog.getByLabel("Role title", { exact: false })).toHaveValue("Backend Intern");
  await expect(dialog.getByLabel("Submitted on", { exact: false })).toHaveValue("2026-10-09");
  await dialog.getByText("More details (priority, links, location, season)", { exact: true }).click();
  await expect(dialog.getByLabel("Locations", { exact: false })).toHaveValue("San Juan, PR");
  await expect(dialog.getByLabel("Requisition ID", { exact: false })).toHaveValue("REQ-42");
  await dialog.getByRole("button", { name: "Save & log another", exact: true }).click();
  await expect(dialog.getByText("Application saved for Northwind.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Company", { exact: false })).toHaveValue("");
  await expect(dialog.getByLabel("Role title", { exact: false })).toHaveValue("");
  await expect(dialog.getByLabel("Job posting link", { exact: false })).toHaveValue("");
  await expect(dialog.getByLabel("Submitted on", { exact: false })).toHaveValue("2026-10-09");
  await expect(dialog.locator("input[name=season]")).toHaveValue("summer");
  await expect(dialog.locator("input[name=season_year]")).toHaveValue("2027");
  await dialog.getByText("Set a follow-up for Northwind", { exact: true }).click();
  await expect(dialog.getByRole("button", { name: "In 7 days", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "In 14 days", exact: true })).toBeVisible();
  await dialog.getByLabel("Job posting link", { exact: false }).fill("https://jobs.example.com/already");
  await expect(dialog.getByText("Possible existing application", { exact: true })).toBeVisible();
  await dialog.getByLabel("Job posting link", { exact: false }).fill("https://jobs.example.com/different");
  await expect(dialog.getByText("Possible existing application", { exact: true })).toBeHidden();
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-quick-log-${viewport?.width}.png`),
    fullPage: false,
  });
  expect(errors).toEqual([]);
});

test("application drawers preserve browsing context and expose notes, links and follow-ups", async ({ page, viewport }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/applications/00000000-0000-4000-8000-000000000001", (route) =>
    route.fulfill({
      json: {
        app: {
          id: "00000000-0000-4000-8000-000000000001",
          company_name: "Example Company",
          role_title: "Backend Intern",
          status: "applied",
          revision: 1,
          submitted_precision: "day",
          submitted_year: 2026,
          submitted_month: 10,
          submitted_day: 13,
          submission_date_unknown: false,
          application_url: "https://example.com/job",
          portal_url: "https://example.com/portal",
          trashed_at: null,
        },
        notes: [{ id: "note-one", body: "Recruiter said **Python** is useful.\nFollow up next week.", created_at: "2026-10-13T12:00:00Z" }],
        tasks: [{ id: "task-one", kind: "follow_up", due_date: "2026-10-20", state: "pending", note: "Email recruiter" }],
        timezone: "America/Puerto_Rico",
      },
    }),
  );
  await page.goto("/ui-review?q=backend&season=all");
  const before = page.url();
  const scroll = await page.evaluate(() => window.scrollY);
  const opener = page.getByRole("link", { name: "Example Company", exact: false }).filter({ visible: true }).first();
  await opener.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Recruiter said", { exact: false })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Open full page", exact: true })).toHaveAttribute(
    "href",
    "/applications/00000000-0000-4000-8000-000000000001",
  );
  await expect(drawer.getByRole("link", { name: "Progress portal", exact: false })).toBeVisible();
  await expect(drawer.getByText("Email recruiter", { exact: true })).toBeVisible();
  await drawer.locator("summary").filter({ hasText: "Update status" }).click();
  await expect(drawer.getByLabel("New status", { exact: true })).toHaveValue("applied");
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: join(process.env.UI_REVIEW_SCREENSHOTS ?? tmpdir(), `hephaestus-application-drawer-${viewport?.width}.png`),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test("returning from an employer's page prompts before logging submission", async ({ page, context }) => {
  await page.route("**/api/applications/duplicates", (route) => route.fulfill({ json: { duplicates: [] } }));
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Synthetic employer application page</p>" }),
  );
  await page.goto("/ui-review?view=jobs");
  const popup = context.waitForEvent("page");
  await page.getByRole("link", { name: /^Apply/ }).click();
  const employer = await popup;
  await employer.waitForLoadState();
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  const prompt = page.getByRole("dialog", { name: "Did you submit?", exact: true });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Not yet", exact: true }).click();
  await expect(prompt).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(prompt).toBeHidden();
  await page.getByRole("link", { name: /^Apply/ }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Yes, I submitted", exact: true }).click();
  const quick = page.getByRole("dialog", { name: "Quick Log", exact: true });
  await expect(quick.getByLabel("Company", { exact: false })).toHaveValue("Example Company");
  await expect(quick.getByLabel("Job posting link", { exact: false })).toHaveValue("https://example.com");
  await expect(quick.getByLabel("Status", { exact: true })).toHaveValue("applied");
  await quick.getByRole("button", { name: "Save & log another", exact: true }).click();
  await expect(quick.getByLabel("Company", { exact: false })).toHaveValue("");
  await quick.getByLabel("Company", { exact: false }).fill("Next Company");
  await quick.getByLabel("Role title", { exact: false }).fill("Next internship");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Quick log application", exact: true }).click();
  await expect(quick.getByLabel("Company", { exact: false })).toHaveValue("Next Company");
  await expect(quick.locator("input[name=job_id]")).toHaveCount(0);
});
