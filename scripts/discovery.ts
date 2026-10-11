import { config as loadEnv } from "dotenv";
import { createSourceFetcher } from "../src/lib/discovery/fetcher";
import { createGithubClient } from "../src/lib/discovery/github";
import { runDiscovery } from "../src/lib/discovery/run";
import { connectFromEnv } from "../src/lib/discovery/pg-db";

// Local runs: load .env.local then .env. dotenv never overrides variables that are already set (CI secrets win) and values are never printed.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main(): Promise<number> {
  if (!process.env.DISCOVERY_DATABASE_URL) {
    console.error("discovery: DISCOVERY_DATABASE_URL is not set");
    return 1;
  }
  const trigger = process.env.DISCOVERY_TRIGGER === "manual" ? "manual" : "schedule";
  const rawCorrelation = process.env.DISCOVERY_CORRELATION_ID?.trim();
  if (rawCorrelation && !UUID.test(rawCorrelation)) {
    console.error("discovery: DISCOVERY_CORRELATION_ID is not a valid UUID");
    return 1;
  }
  const conn = await connectFromEnv();
  if (!conn) return 1;
  const { db, close } = conn;
  try {
    const client = createGithubClient({ token: process.env.GITHUB_TOKEN || null });
    const summary = await runDiscovery({
      db,
      fetcher: createSourceFetcher(client),
      now: () => new Date(),
      trigger,
      correlationId: rawCorrelation || null,
      runnerId: process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : "local",
    });
    console.log(
      `discovery: state=${summary.state} run=${summary.runId ?? "none"}${summary.errorCode ? ` error=${summary.errorCode}` : ""}`,
    );
    for (const s of summary.sources) {
      console.log(
        `  ${s.source}: ${s.outcome}${s.rows !== undefined ? ` rows=${s.rows}` : ""}${s.quarantined !== undefined ? ` quarantined=${s.quarantined}` : ""}${s.errorCode ? ` error=${s.errorCode}` : ""}`,
      );
    }
    console.log(`  counts: ${JSON.stringify(summary.counts)}`);
    return summary.state === "failed" ? 1 : 0;
  } finally {
    await close().catch(() => undefined);
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    const code = (e as { code?: string } | null)?.code;
    console.error(`discovery: fatal error${typeof code === "string" ? ` code=${code}` : ""}`);
    process.exit(1);
  },
);
