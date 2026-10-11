import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInstant } from "@/lib/ui/format";
import { AdminNav } from "../admin-nav";
import { RefreshButton, VerificationForm } from "../admin-forms";
import { dismissCandidateAction, mergeJobsAction, resolveHeldAction, setSourceEnabledAction } from "../actions";

export const metadata = { title: "Admin · Sources" };

export default async function AdminSources() {
  const { supabase, profile } = await requireAdmin();
  const [{ data: sources }, { data: held }, { data: cands }] = await Promise.all([
    supabase.from("job_sources").select("*").order("repo_owner"),
    supabase
      .from("source_runs")
      .select("id, source_id, row_count, baseline_row_count, created_at")
      .eq("state", "held_for_review")
      .order("created_at", { ascending: false }),
    supabase.from("job_merge_candidates").select("id, job_a, job_b, reason").eq("state", "open").limit(25),
  ]);
  const ids = [...new Set((cands ?? []).flatMap((c) => [c.job_a, c.job_b]))];
  const { data: jobs } = ids.length
    ? await supabase.from("jobs").select("id, company, title, locations, apply_url").in("id", ids)
    : { data: [] };
  const byId = new Map((jobs ?? []).map((j) => [j.id, j]));
  const name = (id: string) => {
    const j = byId.get(id);
    return j ? `${j.company} — ${j.title} (${(j.locations as string[] | null)?.join(", ") || "no location"})` : id;
  };
  const srcName = new Map((sources ?? []).map((s) => [s.id, `${s.repo_owner}/${s.repo_name}`]));

  return (
    <>
      <PageHeader title="Admin" description="Shared catalog controls. You cannot see any user's private workspace from here." />
      <AdminNav active="sources" />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Refresh</CardTitle>
            <CardDescription>
              Dispatches the fixed discovery workflow. One request per 15 minutes; overlapping runs are prevented by a lease.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RefreshButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured sources</CardTitle>
            <CardDescription>Only allowlisted GitHub repositories and paths. Users cannot add fetch targets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(sources ?? []).map((s) => (
              <div key={s.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.repo_owner}/{s.repo_name}{" "}
                    <span className="text-muted-foreground">
                      {s.path} · {s.adapter_id} v{s.adapter_version}
                    </span>
                  </span>
                  <form action={setSourceEnabledAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="enabled" value={String(!s.enabled)} />
                    <Button type="submit" size="xs" variant="outline">
                      {s.enabled ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.enabled ? <Badge variant="secondary">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>} · accepted rows{" "}
                  {s.accepted_row_count} · last success {s.last_success_at ? fmtInstant(s.last_success_at, profile.timezone) : "never"} ·
                  branch {s.default_branch ?? "unresolved"} · license {s.license ?? "unknown"}
                </span>
                {s.attribution ? <span className="text-xs text-muted-foreground">{s.attribution}</span> : null}
              </div>
            ))}
            {(sources ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No sources configured.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshots held for review</CardTitle>
            <CardDescription>
              A snapshot with under 50% of the last accepted row count is held; nothing is marked missing until you decide.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(held ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              (held ?? []).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span>
                    {srcName.get(h.source_id) ?? "source"}: {h.row_count} rows vs {h.baseline_row_count} baseline ·{" "}
                    {fmtInstant(h.created_at, profile.timezone)}
                  </span>
                  <span className="flex gap-2">
                    <form action={resolveHeldAction}>
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="approve" value="true" />
                      <Button size="xs" type="submit">
                        Approve
                      </Button>
                    </form>
                    <form action={resolveHeldAction}>
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="approve" value="false" />
                      <Button size="xs" variant="outline" type="submit">
                        Reject
                      </Button>
                    </form>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Possible duplicate listings</CardTitle>
            <CardDescription>
              Same company, title, locations and season but different identities. Merging moves observations and remaps every user&apos;s
              saved/hidden state independently; application snapshots stay unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(cands ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None open.</p>
            ) : (
              (cands ?? []).map((c) => (
                <div key={c.id} className="grid gap-2 rounded-lg border p-3 text-sm">
                  <span>
                    A:{" "}
                    <Link className="underline" href={`/jobs/${c.job_a}`}>
                      {name(c.job_a)}
                    </Link>
                  </span>
                  <span>
                    B:{" "}
                    <Link className="underline" href={`/jobs/${c.job_b}`}>
                      {name(c.job_b)}
                    </Link>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <form action={mergeJobsAction}>
                      <input type="hidden" name="keep" value={c.job_a} />
                      <input type="hidden" name="merge" value={c.job_b} />
                      <Button size="xs" type="submit">
                        Merge B into A
                      </Button>
                    </form>
                    <form action={mergeJobsAction}>
                      <input type="hidden" name="keep" value={c.job_b} />
                      <input type="hidden" name="merge" value={c.job_a} />
                      <Button size="xs" variant="outline" type="submit">
                        Merge A into B
                      </Button>
                    </form>
                    <form action={dismissCandidateAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button size="xs" variant="ghost" type="submit">
                        Not duplicates
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public employer verification</CardTitle>
            <CardDescription>Evidence recorded here is visible to all users. Never paste private user notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <VerificationForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
