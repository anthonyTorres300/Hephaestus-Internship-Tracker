import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { availabilityLabel, evaluate } from "@/lib/jobs/feed";
import type { Job, UserJob } from "@/lib/data/types";
import { MISSING_EVIDENCE, type RuleName } from "@/lib/domain";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/shared/external-link";
import { fmtInstant } from "@/lib/ui/format";
import { JobRow } from "../job-ui";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Job" };

const OUTCOME = { pass: "Matches", fail: "Mismatch", unknown: "Unknown" } as const;

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireWorkspace();
  const now = new Date();
  const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job;
  const [{ data: uj }, { data: obs }, { data: overlay }, { data: apps }] = await Promise.all([
    supabase.from("user_jobs").select("*").eq("job_id", id).maybeSingle(),
    supabase
      .from("job_observations")
      .select("id, permalink, state, first_seen_at, last_seen_at, job_sources(repo_owner, repo_name, attribution, license)")
      .eq("job_id", id),
    supabase.from("job_availability_overlay").select("verified_state, verified_at").eq("job_id", id).maybeSingle(),
    supabase.from("applications").select("id, status").eq("job_id", id).is("trashed_at", null),
  ]);
  const userJob = (uj ?? null) as UserJob | null;
  const { eligibility, score } = evaluate(profile, job, now);
  const rv = overlay?.verified_state
    ? { state: overlay.verified_state as "open" | "closed", verified_at: overlay.verified_at as string }
    : null;
  const item = {
    job,
    eligibility,
    score,
    userJob,
    applied: (apps?.length ?? 0) > 0,
    possiblePrevious: false,
    reviewerVerification: rv,
    seasonMatch: "match" as const,
  };
  const avail = availabilityLabel(item, now);
  const missing = [
    ...new Set([
      ...score.missingEvidence,
      ...eligibility.rules.filter((r) => r.outcome === "unknown").map((r) => MISSING_EVIDENCE[r.rule as RuleName]),
    ]),
  ];

  return (
    <>
      <PageHeader
        title={`${job.company} — ${job.title}`}
        description={avail.text}
        actions={
          <Link href="/jobs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back to jobs
          </Link>
        }
      />
      <ul className="mb-6">
        <JobRow item={item} tz={profile.timezone} now={now} />
      </ul>
      {apps?.length ? (
        <p className="mb-4 text-sm">
          You already have {apps.length} application{apps.length === 1 ? "" : "s"} linked to this listing:{" "}
          {apps.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`} className="underline mr-2">
              view
            </Link>
          ))}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estimated relevance: {score.total}/100</CardTitle>
            <CardDescription>
              Deterministic {score.version} score from your profile. It is not interview probability or ATS compatibility. Recency basis:{" "}
              {score.recencyBasis === "first_seen"
                ? "first seen by this site (not the employer's posting date)"
                : "listing date from the source"}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {score.components.map((c) => (
              <div key={c.name} className="grid gap-0.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{c.name}</span>
                  <span>
                    {c.points}/{c.max}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.explanation}</p>
              </div>
            ))}
            {missing.length ? (
              <div className="mt-2 rounded-lg border p-3 text-xs">
                <p className="font-medium">Missing evidence</p>
                <ul className="ml-4 list-disc">
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility</CardTitle>
            <CardDescription>
              “Matches recorded requirements” is not an employer decision. Unknown means the listing or your profile lacks the fact.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {eligibility.rules.map((r) => (
              <div key={r.rule} className="grid gap-0.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{r.rule.replace(/_/g, " ")}</span>
                  <Badge variant={r.outcome === "fail" ? "destructive" : "outline"}>{OUTCOME[r.outcome]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.reason}
                  {r.evidence?.text ? ` Evidence: ${r.evidence.text}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
            <CardDescription>
              Where this listing comes from. First seen {fmtInstant(job.first_seen_at, profile.timezone)}; last seen{" "}
              {fmtInstant(job.last_seen_at, profile.timezone)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {(obs ?? []).map((o) => {
              const src = (Array.isArray(o.job_sources) ? o.job_sources[0] : o.job_sources) as {
                repo_owner: string;
                repo_name: string;
                attribution: string | null;
                license: string | null;
              } | null;
              return (
                <div key={o.id} className="grid gap-0.5 rounded-lg border p-3">
                  <span className="font-medium">
                    {src ? `${src.repo_owner}/${src.repo_name}` : "Source"} <Badge variant="outline">{o.state.replace(/_/g, " ")}</Badge>
                  </span>
                  {o.permalink ? <ExternalLink href={o.permalink}>View source row on GitHub</ExternalLink> : null}
                  {src?.attribution ? (
                    <span className="text-xs text-muted-foreground">
                      {src.attribution}
                      {src.license ? ` · License: ${src.license}` : ""}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {job.canonical_url ? <p className="text-xs text-muted-foreground break-all">Canonical link: {job.canonical_url}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check the employer&apos;s page</CardTitle>
            <CardDescription>A GitHub listing does not prove the role is open. Record what you found.</CardDescription>
          </CardHeader>
          <CardContent>
            <VerifyForm
              jobId={job.id}
              current={{
                state: userJob?.verification_state ?? "none",
                url: userJob?.verification_url ?? null,
                note: userJob?.verification_note ?? null,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
