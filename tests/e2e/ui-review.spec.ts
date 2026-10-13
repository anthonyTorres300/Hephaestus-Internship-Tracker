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
