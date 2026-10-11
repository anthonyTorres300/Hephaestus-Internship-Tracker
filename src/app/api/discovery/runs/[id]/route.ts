import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// `id` may be a run id or the correlation id returned by the refresh endpoint.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "not_found", "Not found.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  if (!auth.ctx.isAdmin) return jsonError(404, "not_found", "Not found.");
  const { supabase } = auth.ctx;
  const { data: run } = await supabase
    .from("discovery_runs")
    .select("id, trigger, correlation_id, state, started_at, finished_at, counts, error_code")
    .or(`id.eq.${id},correlation_id.eq.${id}`)
    .maybeSingle();
  if (!run) return jsonError(404, "not_found", "Not found.");
  const { data: sources } = await supabase
    .from("source_runs")
    .select("source_id, state, commit_sha, complete, row_count, quarantined_count, baseline_row_count, diagnostics")
    .eq("discovery_run_id", run.id);
  return NextResponse.json({ run, sources }, { headers: noStore() });
}
