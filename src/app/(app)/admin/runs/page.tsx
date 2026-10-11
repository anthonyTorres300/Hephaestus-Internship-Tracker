import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInstant, bytes } from "@/lib/ui/format";
import { AdminNav } from "../admin-nav";

export const metadata = { title: "Admin · Runs" };

export default async function AdminRuns() {
  const { supabase, profile } = await requireAdmin();
  const [{ data: runs }, { data: srs }, { data: m }] = await Promise.all([
    supabase
      .from("discovery_runs")
      .select("id, trigger, state, started_at, finished_at, counts, error_code, correlation_id")
      .order("started_at", { ascending: false })
      .limit(15),
    supabase
      .from("source_runs")
      .select("id, discovery_run_id, source_id, state, commit_sha, row_count, quarantined_count, baseline_row_count, diagnostics")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.rpc("admin_capacity_metrics"),
  ]);
  const metrics = (m ?? {}) as Record<string, number>;
  const tone = (s: string) => (s === "success" ? "secondary" : s === "running" ? "outline" : "destructive");
  return (
    <>
      <PageHeader title="Admin" description="Operational diagnostics contain counts and error codes only." />
      <AdminNav active="runs" />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
            <CardDescription>
              Aggregate counts only. Compare with provider dashboards and your budget alerts (70% / 90% / 100%).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Accounts", metrics.accounts_total],
                ["Active", metrics.accounts_active],
                ["Suspended", metrics.accounts_suspended],
                ["Open deletions", metrics.deletion_requests_open],
                ["Deletions over 24h", metrics.deletion_requests_stale],
                ["Resume storage", bytes(Number(metrics.resume_bytes ?? 0))],
                ["Catalog jobs", metrics.jobs],
                ["Duplicate candidates", metrics.open_merge_candidates],
                ["Held snapshots", metrics.held_snapshots],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-xl font-semibold">{v ?? 0}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent discovery runs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(runs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No runs yet. Trigger the discovery workflow from GitHub Actions or the Sources tab.
              </p>
            ) : (
              (runs ?? []).map((r) => (
                <div key={r.id} className="grid gap-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Badge variant={tone(r.state)}>{r.state.replace(/_/g, " ")}</Badge> {r.trigger} ·{" "}
                      {fmtInstant(r.started_at, profile.timezone)}
                      {r.finished_at ? ` → ${fmtInstant(r.finished_at, profile.timezone)}` : ""}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 8)}
                      {r.error_code ? ` · ${r.error_code}` : ""}
                    </span>
                  </div>
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {(srs ?? [])
                      .filter((s) => s.discovery_run_id === r.id)
                      .map((s) => (
                        <li key={s.id}>
                          {s.state.replace(/_/g, " ")} · {s.row_count} rows (baseline {s.baseline_row_count}, quarantined{" "}
                          {s.quarantined_count}){s.commit_sha ? ` · ${String(s.commit_sha).slice(0, 7)}` : ""}
                          {(s.diagnostics as { error_code?: string })?.error_code
                            ? ` · ${(s.diagnostics as { error_code?: string }).error_code}`
                            : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
