import type { SupabaseClient } from "@supabase/supabase-js";
import { stageRows, type ColumnMap, type ExistingAppKey, type Issue, type ProposedApplication, type StagedRow } from "@/lib/import";
import type { AppStatus } from "@/lib/import/status";

export interface BatchSummary {
  headers: string[];
  columnMap: ColumnMap;
  statusMap: Record<string, AppStatus>;
  delimiter: string;
  nonblank: number;
  source: "file" | "paste";
  created?: number;
  linked?: number;
  skipped?: number;
  failed?: number;
  total?: number;
  undo_trashed?: number;
  undo_kept_for_review?: number;
}

export interface BatchRow {
  id: string;
  ordinal: number;
  raw_values: Record<string, unknown>;
  proposed: ProposedApplication;
  warnings: Issue[];
  errors: Issue[];
  decision: "pending" | "accept" | "skip" | "linked";
  outcome: string | null;
  application_id: string | null;
  linked_application_id: string | null;
}

export async function existingApps(supabase: SupabaseClient): Promise<ExistingAppKey[]> {
  const { data } = await supabase
    .from("applications")
    .select(
      "id, company_name, role_title, submitted_precision, submitted_year, submitted_month, submitted_day, confirmed_identity, portal_url",
    )
    .is("trashed_at", null)
    .limit(2000);
  return (data ?? []) as ExistingAppKey[];
}

const OV = "__ov";

export function rowsToStorage(staged: StagedRow[], overrides: Record<number, Record<string, string>>) {
  return staged.map((r) => ({
    ordinal: r.ordinal,
    raw_values: overrides[r.ordinal] ? { ...r.raw, [OV]: overrides[r.ordinal] } : r.raw,
    proposed: r.proposed,
    row_fingerprint: r.fingerprint,
    warnings: r.warnings,
    errors: r.errors,
    decision: r.decision,
  }));
}

export async function insertRows(
  supabase: SupabaseClient,
  userId: string,
  batchId: string,
  rows: ReturnType<typeof rowsToStorage>,
  extra: Record<number, { linked_application_id?: string | null }> = {},
) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows
      .slice(i, i + 500)
      .map((r) => ({ user_id: userId, batch_id: batchId, ...r, linked_application_id: extra[r.ordinal]?.linked_application_id ?? null }));
    const { error } = await supabase.from("import_rows").insert(chunk);
    if (error) return error;
  }
  return null;
}

/** Rebuilds the table from stored raw cells, applies mapping/overrides, and replaces the staged rows (decisions are preserved). */
export async function restageBatch(
  supabase: SupabaseClient,
  userId: string,
  batchId: string,
  change: { statusMap?: Record<string, AppStatus>; overrides?: Record<number, Record<string, string>> },
) {
  const { data: batch } = await supabase.from("import_batches").select("id, state, summary").eq("id", batchId).maybeSingle();
  if (!batch || batch.state !== "staged") return { error: "not_staged" as const };
  const summary = batch.summary as BatchSummary;
  const { data: rows } = await supabase
    .from("import_rows")
    .select("ordinal, raw_values, decision, linked_application_id")
    .eq("batch_id", batchId)
    .order("ordinal");
  if (!rows) return { error: "load_failed" as const };

  const names = summary.headers.map((h, i, arr) => (arr.indexOf(h) === i ? h : `${h}#${i + 1}`));
  const overrides: Record<number, Record<string, string>> = {};
  const cells = rows.map((r) => {
    const raw = r.raw_values as Record<string, unknown>;
    if (raw[OV]) overrides[r.ordinal] = { ...(raw[OV] as Record<string, string>) };
    return names.map((n) => String(raw[n] ?? ""));
  });
  for (const [k, v] of Object.entries(change.overrides ?? {})) overrides[Number(k)] = { ...(overrides[Number(k)] ?? {}), ...v };
  const statusMap = { ...summary.statusMap, ...(change.statusMap ?? {}) };

  const staged = stageRows(
    { headers: summary.headers, rows: cells },
    { columnMap: summary.columnMap, statusMap, existing: await existingApps(supabase), attestSubmitted: true, overrides },
  );
  const prev = new Map(rows.map((r) => [r.ordinal, r]));
  for (const s of staged) {
    const p = prev.get(s.ordinal);
    if (p && p.decision !== "pending") s.decision = p.decision as StagedRow["decision"];
  }

  const del = await supabase.from("import_rows").delete().eq("batch_id", batchId);
  if (del.error) return { error: "delete_failed" as const };
  const extra = Object.fromEntries(rows.map((r) => [r.ordinal, { linked_application_id: r.linked_application_id }]));
  const err = await insertRows(supabase, userId, batchId, rowsToStorage(staged, overrides), extra);
  if (err) return { error: "insert_failed" as const };
  await supabase
    .from("import_batches")
    .update({ summary: { ...summary, statusMap } })
    .eq("id", batchId);
  return { ok: true as const };
}
