import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

// PostgREST caps responses (default 1000 rows); page through everything the RLS-scoped session can see.
export async function fetchAll<T = Record<string, unknown>>(supabase: SupabaseClient, table: string, order = "id"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`export_failed:${table}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export const OWNER_TABLES = [
  "applications",
  "application_status_events",
  "application_notes",
  "interview_events",
  "offer_events",
  "tasks",
  "task_events",
  "user_jobs",
  "practice_problems",
  "problem_topics",
  "practice_attempts",
  "import_batches",
  "import_rows",
] as const;
