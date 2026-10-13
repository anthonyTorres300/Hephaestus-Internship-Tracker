import { copyFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const directory = join(root, "src/app/ui-review");
const target = join(directory, "page.tsx");
const baseURL = process.env.UI_REVIEW_BASE_URL ?? "http://localhost:3000";
const url = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("UI review requires a local development server.");
if (existsSync(directory)) throw new Error("The UI review route already exists; refusing to replace it.");
mkdirSync(directory);
let status = 1;
try {
  copyFileSync(join(root, "tests/fixtures/ui-review/page.tsx"), target);
  const result = spawnSync(process.execPath, [join(root, "node_modules/@playwright/test/cli.js"), "test", "tests/e2e/ui-review.spec.ts"], {
    stdio: "inherit",
    env: { ...process.env, UI_REVIEW: "1", E2E_BASE_URL: baseURL, UI_REVIEW_SCREENSHOTS: tmpdir() },
  });
  status = result.status ?? 1;
} finally {
  if (existsSync(target)) unlinkSync(target);
  rmdirSync(directory);
}
process.exitCode = status;
