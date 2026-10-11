import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FetchOutcome, SourceFetcher } from "@/lib/discovery/fetcher";
import {
  overallState,
  runDiscovery,
  type DbSource,
  type DiscoveryDb,
  type IngestArgs,
  type IngestResult,
  type RunState,
} from "@/lib/discovery/run";
import { SOURCES } from "@/lib/discovery/sources";
import { DiscoveryError } from "@/lib/discovery/types";

const fx = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures/discovery", n), "utf8");
const SHA = "d".repeat(40);

const src = (id: string, owner: string, repo: string, adapter: string, extra: Partial<DbSource> = {}): DbSource => ({
  id,
  repo_owner: owner,
  repo_name: repo,
  path: "README.md",
  adapter_id: adapter,
  adapter_version: "1",
  etag: '"e"',
  last_commit_sha: "c".repeat(40),
  accepted_row_count: 10,
  ...extra,
});
const SIMPLIFY = src("s1", "SimplifyJobs", "Summer2027-Internships", "simplify");
const VANSH = src("s2", "vanshb03", "Summer2027-Internships", "vansh");

function harness(
  opts: {
    sources?: DbSource[];
    lease?: string | null;
    ingest?: (a: IngestArgs) => IngestResult | Promise<IngestResult>;
    outcomes?: Record<string, FetchOutcome | Error>;
  } = {},
) {
  const log = {
    finished: [] as { state: RunState; counts: Record<string, number>; error: string | null }[],
    failures: [] as { source: string; code: string; diag: unknown }[],
    notModified: [] as string[],
    ingested: [] as IngestArgs[],
  };
  const db: DiscoveryDb = {
    getEnabledSources: async () => opts.sources ?? [SIMPLIFY, VANSH],
    acquireLease: async () => (opts.lease === undefined ? "run-1" : opts.lease),
    finishRun: async (_r, state, counts, error) => void log.finished.push({ state, counts, error }),
    recordSourceFailure: async (_r, source, code, diag) => void log.failures.push({ source, code, diag }),
    recordNotModified: async (_r, source) => void log.notModified.push(source),
    ingestSnapshot: async (a) => {
      log.ingested.push(a);
      if (opts.ingest) return opts.ingest(a);
      return a.complete
        ? { state: "success", rows: a.rows.length, new_jobs: a.rows.length, new_observations: a.rows.length }
        : { state: "failed", reason: "incomplete_snapshot" };
    },
  };
  const fetcher: SourceFetcher = {
    fetch: async (req) => {
      const o = opts.outcomes?.[req.repo === "Summer2027-Internships" && req.owner === "SimplifyJobs" ? "simplify" : "vansh"];
      if (o instanceof Error) throw o;
      return (
        o ?? {
          kind: "content",
          text: fx(req.owner === "SimplifyJobs" ? "simplify-readme.md" : "vansh-readme.md"),
          commitSha: SHA,
          etag: '"n"',
          defaultBranch: "dev",
        }
      );
    },
  };
  return {
    db,
    fetcher,
    log,
    run: () =>
      runDiscovery({
        db,
        fetcher,
        now: () => new Date("2026-10-10T10:17:00Z"),
        trigger: "schedule",
        correlationId: null,
        maxQuarantineRatio: 0.5,
      }),
  };
}

describe("runDiscovery", () => {
  it("exits cleanly with skipped_overlap when the lease is held", async () => {
    const h = harness({ lease: null });
    const r = await h.run();
    expect(r).toMatchObject({ state: "skipped_overlap", runId: null });
    expect(h.log.ingested).toHaveLength(0);
    expect(h.log.finished).toHaveLength(0);
  });

  it("ingests each source and finishes success with safe aggregate counts", async () => {
    const h = harness();
    const r = await h.run();
    expect(r.state).toBe("success");
    expect(h.log.ingested.map((a) => a.sourceId)).toEqual(["s1", "s2"]);
    const a = h.log.ingested[0];
    expect(a).toMatchObject({ commitSha: SHA, etag: '"n"', complete: true });
    expect(a.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.rows[0]).toHaveProperty("entry_key");
    const fin = h.log.finished[0];
    expect(fin.state).toBe("success");
    expect(Object.values(fin.counts).every((v) => typeof v === "number")).toBe(true);
    expect(JSON.stringify(fin)).not.toMatch(/Electronic Arts|https?:|README/);
    expect(JSON.stringify(a.diagnostics)).not.toMatch(/Electronic Arts|<td|href/);
  });

  it("isolates source failures: one adapter failing never affects the other (partial)", async () => {
    const h = harness({ outcomes: { simplify: new DiscoveryError("timeout") } });
    const r = await h.run();
    expect(r.state).toBe("partial");
    expect(h.log.failures).toEqual([{ source: "s1", code: "timeout", diag: {} }]);
    expect(h.log.ingested.map((a) => a.sourceId)).toEqual(["s2"]);
    expect(h.log.finished[0]).toMatchObject({ state: "partial", error: "timeout" });
  });

  it("is failed only when every source fails, preserving the lease bookkeeping", async () => {
    const h = harness({ outcomes: { simplify: new DiscoveryError("rate_limited"), vansh: new Error("boom") } });
    const r = await h.run();
    expect(r.state).toBe("failed");
    expect(h.log.failures.map((f) => f.code)).toEqual(["rate_limited", "unexpected_error"]);
    expect(h.log.finished[0].state).toBe("failed");
  });

  it("marks incomplete snapshots (structural parse failure, too many malformed rows) complete=false", async () => {
    const h = harness({
      outcomes: { simplify: { kind: "content", text: "# no tables", commitSha: SHA, etag: null, defaultBranch: "dev" } },
      ingest: (a) => (a.complete ? { state: "success", rows: a.rows.length } : { state: "failed", reason: "incomplete_snapshot" }),
    });
    const r = await h.run();
    expect(h.log.ingested[0]).toMatchObject({ complete: false, rows: [] });
    expect(h.log.ingested[0].diagnostics).toMatchObject({ parse_error: "no_tables_found" });
    expect(r.sources[0]).toMatchObject({ outcome: "failed", errorCode: "no_tables_found" });
    expect(r.state).toBe("partial");
    const bad = harness({ sources: [VANSH] });
    const strict = await runDiscovery({
      db: bad.db,
      fetcher: bad.fetcher,
      now: () => new Date(),
      trigger: "manual",
      correlationId: null,
      maxQuarantineRatio: 0.0001,
    });
    expect(bad.log.ingested[0].complete).toBe(false);
    expect(strict.sources[0].errorCode).toBe("too_many_malformed_rows");
  });

  it("reports held_for_review when the DB holds a suspicious snapshot", async () => {
    const h = harness({ ingest: (a) => (a.sourceId === "s1" ? { state: "held_for_review", rows: 3 } : { state: "success", rows: 5 }) });
    const r = await h.run();
    expect(r.state).toBe("held_for_review");
    expect(h.log.finished[0]).toMatchObject({ state: "held_for_review", error: "suspicious_row_drop" });
  });

  it("records 304 as not_modified without parsing or ingesting", async () => {
    const nm: FetchOutcome = { kind: "not_modified", commitSha: SHA, etag: '"e"' };
    const h = harness({ outcomes: { simplify: nm, vansh: nm } });
    const r = await h.run();
    expect(r.state).toBe("success");
    expect(h.log.notModified).toEqual(["s1", "s2"]);
    expect(h.log.ingested).toHaveLength(0);
  });

  it("does not use etags when there is no accepted baseline", async () => {
    const seen: unknown[] = [];
    const h = harness({ sources: [{ ...SIMPLIFY, accepted_row_count: 0 }] });
    const orig = h.fetcher.fetch;
    h.fetcher.fetch = async (req) => (seen.push([req.etag, req.lastCommitSha]), orig(req));
    await h.run();
    expect(seen).toEqual([[null, null]]);
  });

  it("refuses DB sources that are not in the checked-in allowlist and survives bookkeeping errors", async () => {
    const h = harness({ sources: [src("x", "evil", "repo", "simplify"), VANSH] });
    h.db.recordSourceFailure = async () => {
      throw new Error("db down");
    };
    const r = await h.run();
    expect(r.sources[0]).toMatchObject({ outcome: "failed", errorCode: "source_not_configured" });
    expect(r.state).toBe("partial");
  });

  it("maps database exceptions to safe codes and always finishes the run", async () => {
    const h = harness({
      ingest: () => {
        throw Object.assign(new Error("secret connection string postgres://u:p@h/db"), { code: "PT409" });
      },
    });
    const r = await h.run();
    expect(r.state).toBe("failed");
    expect(h.log.failures.every((f) => f.code === "db_error_PT409")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/postgres:|secret/);
  });

  it("fails with no_enabled_sources when nothing is configured", async () => {
    const h = harness({ sources: [] });
    expect((await h.run()).errorCode).toBe("no_enabled_sources");
  });

  it("overall state precedence", () => {
    expect(overallState([])).toBe("failed");
    expect(overallState(["success", "not_modified"])).toBe("success");
    expect(overallState(["failed", "failed"])).toBe("failed");
    expect(overallState(["success", "failed"])).toBe("partial");
    expect(overallState(["held_for_review", "failed"])).toBe("held_for_review");
  });
});

describe("runDiscovery source sync", () => {
  function syncRun(syncSources: DiscoveryDb["syncSources"], lease: string | null = "run-1") {
    const h = harness({ lease });
    const order: string[] = [];
    const db: DiscoveryDb = {
      ...h.db,
      acquireLease: async (...a) => (order.push("lease"), h.db.acquireLease(...a)),
      getEnabledSources: async () => (order.push("get_enabled_sources"), h.db.getEnabledSources()),
      ...(syncSources ? { syncSources: async (c) => (order.push("sync"), syncSources(c)) } : {}),
    };
    const run = () =>
      runDiscovery({ db, fetcher: h.fetcher, now: () => new Date(), trigger: "schedule", correlationId: null, maxQuarantineRatio: 0.5 });
    return { order, run, log: h.log };
  }

  it("syncs the checked-in configs once, after the lease and before reading enabled sources", async () => {
    const calls: unknown[] = [];
    const t = syncRun(async (c) => void calls.push(c));
    const r = await t.run();
    expect(r.state).toBe("success");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(SOURCES);
    expect(t.order.slice(0, 3)).toEqual(["lease", "sync", "get_enabled_sources"]);
  });

  it("ignores a failing sync (missing function, grant error) and still runs every source", async () => {
    const t = syncRun(async () => {
      throw Object.assign(new Error("function public.sync_job_sources does not exist"), { code: "42883" });
    });
    const r = await t.run();
    expect(r.state).toBe("success");
    expect(t.log.ingested).toHaveLength(2);
    expect(t.log.finished[0].state).toBe("success");
  });

  it("does not sync when the lease is held by another run", async () => {
    const calls: unknown[] = [];
    const t = syncRun(async (c) => void calls.push(c), null);
    expect((await t.run()).state).toBe("skipped_overlap");
    expect(calls).toHaveLength(0);
  });

  it("works with a database object that has no syncSources", async () => {
    expect((await syncRun(undefined).run()).state).toBe("success");
  });

  it("accepts an explicit source list override", async () => {
    const calls: unknown[] = [];
    const h = harness();
    await runDiscovery({
      db: { ...h.db, syncSources: async (c) => void calls.push(c) },
      fetcher: h.fetcher,
      now: () => new Date(),
      trigger: "manual",
      correlationId: null,
      sources: SOURCES.slice(0, 1),
    });
    expect(calls).toEqual([SOURCES.slice(0, 1)]);
  });
});
