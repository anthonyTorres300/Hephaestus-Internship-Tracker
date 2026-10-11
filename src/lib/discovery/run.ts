import { ADAPTERS } from "./adapters";
import type { SourceFetcher } from "./fetcher";
import { sha256Hex } from "./identity";
import { MAX_QUARANTINE_RATIO, SOURCES, findSource, type SourceConfig } from "./sources";
import { DiscoveryError, errorCode, type Adapter, type AdapterResult } from "./types";

export type RunState = "success" | "partial" | "failed" | "held_for_review";
export type SourceOutcome = "success" | "not_modified" | "failed" | "held_for_review";

export interface DbSource {
  id: string;
  repo_owner: string;
  repo_name: string;
  path: string;
  adapter_id: string;
  adapter_version: string;
  etag: string | null;
  last_commit_sha: string | null;
  accepted_row_count: number;
}

export interface IngestArgs {
  runId: string;
  sourceId: string;
  commitSha: string;
  payloadHash: string;
  etag: string | null;
  complete: boolean;
  quarantined: number;
  diagnostics: Record<string, unknown>;
  rows: unknown[];
}

export interface IngestResult {
  state?: string;
  reason?: string;
  rows?: number;
  new_jobs?: number;
  new_observations?: number;
  changed?: number;
  marked_missing?: number;
}

export interface DiscoveryDb {
  getEnabledSources(): Promise<DbSource[]>;
  acquireLease(trigger: "schedule" | "manual", correlationId: string | null, runnerId: string): Promise<string | null>;
  finishRun(runId: string, state: RunState, counts: Record<string, number>, errorCode: string | null): Promise<void>;
  recordSourceFailure(runId: string, sourceId: string, code: string, diag: Record<string, unknown>): Promise<void>;
  recordNotModified(runId: string, sourceId: string, etag: string | null, commitSha: string): Promise<void>;
  ingestSnapshot(args: IngestArgs): Promise<IngestResult>;
  /** Optional: registers new checked-in sources (insert-only; never re-enables a disabled one). Failures are ignored by the runner. */
  syncSources?(configs: readonly SourceConfig[]): Promise<unknown>;
}

export interface RunOptions {
  db: DiscoveryDb;
  fetcher: SourceFetcher;
  now: () => Date;
  trigger: "schedule" | "manual";
  correlationId: string | null;
  runnerId?: string;
  adapters?: Record<string, Adapter>;
  maxQuarantineRatio?: number;
  /** Source configuration to sync into job_sources at the start of a run (defaults to the checked-in SOURCES). */
  sources?: readonly SourceConfig[];
}

export interface SourceSummary {
  source: string;
  outcome: SourceOutcome;
  rows?: number;
  quarantined?: number;
  errorCode?: string;
}

export interface RunSummary {
  state: RunState | "skipped_overlap";
  runId: string | null;
  sources: SourceSummary[];
  counts: Record<string, number>;
  errorCode?: string;
}

export function overallState(outcomes: SourceOutcome[]): RunState {
  if (outcomes.length === 0) return "failed";
  const ok = outcomes.filter((o) => o === "success" || o === "not_modified").length;
  if (ok === 0 && !outcomes.includes("held_for_review")) return "failed";
  if (outcomes.includes("held_for_review")) return "held_for_review";
  return outcomes.includes("failed") ? "partial" : "success";
}

export function assessCompleteness(r: AdapterResult, maxRatio: number): { complete: boolean; reason?: string } {
  if (!r.complete) return { complete: false, reason: r.errorCode ?? "incomplete_parse" };
  const bad = r.stats.quarantined ?? r.quarantined.length;
  const total = r.rows.length + bad;
  if (total > 0 && bad / total > maxRatio) return { complete: false, reason: "too_many_malformed_rows" };
  return { complete: true };
}

function diagnostics(adapter: Adapter, r: AdapterResult, reason?: string): Record<string, unknown> {
  const reasons: Record<string, number> = {};
  for (const q of r.quarantined) reasons[q.code] = (reasons[q.code] ?? 0) + 1;
  return {
    adapter_id: adapter.id,
    adapter_version: adapter.version,
    stats: r.stats,
    quarantine_reasons: reasons,
    ...(reason ? { parse_error: reason } : {}),
  };
}

const safeCode = (c: string) => c.replace(/[^a-z0-9_]/gi, "_").slice(0, 64);

export async function runDiscovery(opts: RunOptions): Promise<RunSummary> {
  const { db } = opts;
  const adapters = opts.adapters ?? ADAPTERS;
  const maxRatio = opts.maxQuarantineRatio ?? MAX_QUARANTINE_RATIO;
  const started = opts.now().getTime();

  const runId = await db.acquireLease(opts.trigger, opts.correlationId, opts.runnerId ?? "local");
  if (!runId) return { state: "skipped_overlap", runId: null, sources: [], counts: {} };

  const summaries: SourceSummary[] = [];
  const counts: Record<string, number> = {
    sources_total: 0,
    sources_success: 0,
    sources_not_modified: 0,
    sources_failed: 0,
    sources_held: 0,
    rows_accepted: 0,
    rows_quarantined: 0,
    new_jobs: 0,
    new_observations: 0,
    changed: 0,
    marked_missing: 0,
  };
  let firstError: string | undefined;

  try {
    if (db.syncSources) {
      try {
        await db.syncSources(opts.sources ?? SOURCES);
      } catch {
        /* sync is best-effort (older database, missing grant): never fail a run because of it */
      }
    }
    const sources = await db.getEnabledSources();
    counts.sources_total = sources.length;
    for (const src of sources) {
      const label = `${src.repo_owner}/${src.repo_name}`;
      const fail = async (code: string, diag: Record<string, unknown> = {}, rows?: number, quarantined?: number) => {
        code = safeCode(code);
        counts.sources_failed++;
        firstError ??= code;
        summaries.push({ source: label, outcome: "failed", errorCode: code, rows, quarantined });
        try {
          await db.recordSourceFailure(runId, src.id, code, diag);
        } catch {
          /* failure bookkeeping must never abort other sources */
        }
      };
      try {
        const cfg = findSource(src.repo_owner, src.repo_name, src.path, src.adapter_id);
        if (!cfg) {
          await fail("source_not_configured");
          continue;
        }
        const adapter = adapters[cfg.adapterId];
        if (!adapter) {
          await fail("adapter_missing");
          continue;
        }
        const baseline = src.accepted_row_count > 0;
        const out = await opts.fetcher.fetch({
          owner: cfg.owner,
          repo: cfg.repo,
          path: cfg.path,
          etag: baseline ? src.etag : null,
          lastCommitSha: baseline ? src.last_commit_sha : null,
        });
        if (out.kind === "not_modified") {
          await db.recordNotModified(runId, src.id, out.etag, out.commitSha);
          counts.sources_not_modified++;
          summaries.push({ source: label, outcome: "not_modified" });
          continue;
        }
        if (!out.text.trim()) throw new DiscoveryError("empty_source");
        const parsed = adapter.parse(out.text, { owner: cfg.owner, repo: cfg.repo, path: cfg.path, commitSha: out.commitSha });
        const verdict = assessCompleteness(parsed, maxRatio);
        const quarantined = parsed.stats.quarantined ?? parsed.quarantined.length;
        const res = await db.ingestSnapshot({
          runId,
          sourceId: src.id,
          commitSha: out.commitSha,
          payloadHash: sha256Hex(out.text),
          etag: out.etag,
          complete: verdict.complete,
          quarantined,
          diagnostics: diagnostics(adapter, parsed, verdict.reason),
          rows: parsed.rows,
        });
        counts.rows_quarantined += quarantined;
        if (res.state === "success") {
          counts.sources_success++;
          counts.rows_accepted += res.rows ?? parsed.rows.length;
          for (const k of ["new_jobs", "new_observations", "changed", "marked_missing"] as const) counts[k] += res[k] ?? 0;
          summaries.push({ source: label, outcome: "success", rows: res.rows ?? parsed.rows.length, quarantined });
        } else if (res.state === "held_for_review") {
          counts.sources_held++;
          firstError ??= "suspicious_row_drop";
          summaries.push({ source: label, outcome: "held_for_review", rows: res.rows, quarantined });
        } else {
          counts.sources_failed++;
          const code = safeCode(verdict.reason ?? res.reason ?? "ingest_failed");
          firstError ??= code;
          summaries.push({ source: label, outcome: "failed", errorCode: code, rows: parsed.rows.length, quarantined });
        }
      } catch (e) {
        await fail(errorCode(e));
      }
    }
    const state = overallState(summaries.map((s) => s.outcome));
    counts.duration_ms = opts.now().getTime() - started;
    const code = state === "success" ? null : state === "failed" && sources.length === 0 ? "no_enabled_sources" : (firstError ?? null);
    await db.finishRun(runId, state, counts, code);
    return { state, runId, sources: summaries, counts, errorCode: code ?? undefined };
  } catch (e) {
    counts.duration_ms = opts.now().getTime() - started;
    const code = safeCode(errorCode(e));
    try {
      await db.finishRun(runId, "failed", counts, code);
    } catch {
      /* lease expires on its own */
    }
    return { state: "failed", runId, sources: summaries, counts, errorCode: code };
  }
}
