import { Client } from "pg";
import { readFileSync } from "node:fs";
import type { DbSource, DiscoveryDb, IngestResult } from "./run";
import type { SourceConfig } from "./sources";

export function connectionConfig(rawUrl: string, ca?: string | null) {
  const u = new URL(rawUrl);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  return {
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 20_000,
    statement_timeout: 120_000,
  };
}

export async function connectPg(url: string, ca?: string | null): Promise<{ db: DiscoveryDb; close: () => Promise<void> }> {
  const client = new Client(connectionConfig(url, ca));
  await client.connect();
  const one = async <T>(sql: string, params: unknown[]): Promise<T> => (await client.query(sql, params)).rows[0] as T;
  const db: DiscoveryDb = {
    async getEnabledSources() {
      return (await client.query("select * from public.get_enabled_sources()")).rows as DbSource[];
    },
    async acquireLease(trigger, correlationId, runnerId) {
      return (
        await one<{ id: string | null }>("select public.acquire_discovery_lease($1, $2::uuid, $3) as id", [
          trigger,
          correlationId,
          runnerId,
        ])
      ).id;
    },
    async finishRun(runId, state, counts, errorCode) {
      await client.query("select public.finish_discovery_run($1::uuid, $2, $3::jsonb, $4)", [
        runId,
        state,
        JSON.stringify(counts),
        errorCode,
      ]);
    },
    async recordSourceFailure(runId, sourceId, code, diag) {
      await client.query("select public.record_source_failure($1::uuid, $2::uuid, $3, $4::jsonb)", [
        runId,
        sourceId,
        code,
        JSON.stringify(diag),
      ]);
    },
    async recordNotModified(runId, sourceId, etag, commitSha) {
      await client.query("select public.record_source_not_modified($1::uuid, $2::uuid, $3, $4)", [runId, sourceId, etag, commitSha]);
    },
    async syncSources(configs: readonly SourceConfig[]) {
      const payload = configs
        .filter((c) => c.enabled)
        .map((c) => ({
          owner: c.owner,
          repo: c.repo,
          path: c.path,
          adapterId: c.adapterId,
          adapterVersion: c.adapterVersion,
          license: c.license,
          attribution: c.attribution,
        }));
      try {
        // A savepoint-free single statement: if the function is missing (42883) or rejects the input, the connection stays usable.
        await client.query("select public.sync_job_sources($1::jsonb)", [JSON.stringify(payload)]);
      } catch {
        /* older database without migration 0010, missing grant, or invalid config: continue with the sources already registered */
      }
    },
    async ingestSnapshot(a) {
      const r = await one<{ r: IngestResult }>(
        "select public.ingest_source_snapshot($1::uuid, $2::uuid, $3, $4, $5, $6::boolean, $7::integer, $8::jsonb, $9::jsonb) as r",
        [
          a.runId,
          a.sourceId,
          a.commitSha,
          a.payloadHash,
          a.etag,
          a.complete,
          a.quarantined,
          JSON.stringify(a.diagnostics),
          JSON.stringify(a.rows),
        ],
      );
      return r.r;
    },
  };
  return { db, close: () => client.end() };
}

// CA certificate for the database TLS chain: inline PEM, or a path to a PEM file (easier in .env.local).
export function loadCaFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const file = env.DISCOVERY_DATABASE_CA_FILE;
  if (file) return readFileSync(file, "utf8");
  return env.DISCOVERY_DATABASE_CA?.replace(/\\n/g, "\n");
}

export const discoveryConfigured = (env: NodeJS.ProcessEnv = process.env) => !!env.DISCOVERY_DATABASE_URL;

/** Connects with the restricted ingestion role from env. Returns null when DISCOVERY_DATABASE_URL is not set. */
export async function connectFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = env.DISCOVERY_DATABASE_URL;
  if (!url) return null;
  return connectPg(url, loadCaFromEnv(env));
}
