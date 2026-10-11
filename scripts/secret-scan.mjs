// Fails when credential-shaped strings appear in tracked files or in the browser bundle (AC-18).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PATTERNS = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["Postgres URL with password", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]{6,}@(?!localhost|127\.0\.0\.1|HOST|host)/],
  ["GitHub token", /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}\b|github_pat_[A-Za-z0-9_]{40,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["JWT with service_role claim", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*(?:c2VydmljZV9yb2xl)[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{10,}/],
];
const SERVER_ONLY_NAMES = ["SUPABASE_SECRET_KEY", "DISCOVERY_DATABASE_URL", "GITHUB_WORKFLOW_DISPATCH_TOKEN", "RATE_LIMIT_SALT"];

const findings = [];
const scan = (file, text) => {
  for (const [name, re] of PATTERNS) if (re.test(text)) findings.push(`${file}: ${name}`);
};

const tracked = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
for (const f of tracked) {
  if (!existsSync(f) || /package-lock\.json$|\.(png|ico|jpg|woff2?)$/.test(f) || f === "scripts/secret-scan.mjs") continue;
  if (statSync(f).size > 2_000_000) continue;
  scan(f, readFileSync(f, "utf8"));
  if (/\.env(\.|$)/.test(f) && f !== ".env.example") findings.push(`${f}: env file must not be tracked`);
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    : [];
for (const f of walk(".next/static")) {
  const text = readFileSync(f, "utf8");
  scan(f, text);
  for (const n of SERVER_ONLY_NAMES) if (text.includes(n)) findings.push(`${f}: server-only variable name ${n} present in client bundle`);
}

if (findings.length) {
  console.error("Secret scan failed:\n" + findings.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`Secret scan passed (${tracked.length} tracked files, client bundle checked).`);
