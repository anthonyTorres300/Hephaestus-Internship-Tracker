import Link from "next/link";
import { displayName } from "@/lib/auth/display-name";
import { cookies } from "next/headers";
import { JOB_PREFS_COOKIE, parseJobPrefs } from "@/lib/jobs/prefs";
import { requireWorkspace } from "@/lib/auth/session";
import { fetchAll } from "@/lib/data/export";
import { loadFeed } from "@/lib/jobs/feed";
import { loadSeasons, parseSeasonKey, seasonKey } from "@/lib/data/seasons";
import { loadPractice } from "@/lib/data/practice";
import { CompanyLogo } from "@/components/shared/company-logo";
import { PageHeader } from "@/components/layout/page-header";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { Badge } from "@/components/ui/badge";
import { AutoSubmitForm } from "@/components/forms/auto-submit-form";
import { NativeSelect } from "@/components/forms/fields";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cohortFilter,
  classifyTask,
  interviewCount,
  offerRate,
  pipelineCounts,
  sortTasks,
  STATUSES,
  STATUS_LABEL,
  type Status,
  submittedCount,
  weeklyApplications,
  type AppRow,
  type Cohort,
} from "@/lib/domain";
import type { Task } from "@/lib/data/types";
import { fmtWeek, fmtDateOnly, fmtInstant } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { supabase, profile, user } = await requireWorkspace();
  const sp = await searchParams;
  const name = displayName(user);
  const jobPrefs = parseJobPrefs((await cookies()).get(JOB_PREFS_COOKIE)?.value);
  const now = new Date();
  const tz = profile.timezone;

  const [apps, offers, interviews, statusEvents, tasks, practice, feed, health, seasons] = await Promise.all([
    fetchAll<AppRow & { company_name: string }>(supabase, "applications"),
    fetchAll<{ application_id: string }>(supabase, "offer_events"),
    fetchAll<{ application_id: string }>(supabase, "interview_events"),
    fetchAll<{ application_id: string; new_status: string }>(supabase, "application_status_events"),
    fetchAll<Task>(supabase, "tasks"),
    loadPractice(supabase, tz, profile.weekly_practice_goal, now),
    loadFeed(
      supabase,
      profile,
      {
        firstSeenAfter: new Date(now.getTime() - 7 * 86400_000).toISOString(),
        season: "target",
        sort: "first_seen",
        role: jobPrefs.role,
        undergradOnly: jobPrefs.undergradOnly,
      },
      now,
    ),
    supabase.from("feed_health").select("repository, last_success_at, stale"),
    loadSeasons(supabase, { season: profile.target_season, year: profile.target_year }),
  ]);

  const targetKey = seasonKey(profile.target_season, profile.target_year);
  const seasonSel = sp.season ?? targetKey;
  const picked = parseSeasonKey(seasonSel);
  const cohort: Cohort =
    seasonSel === "all"
      ? { allHistory: true, includeUnclassified: true, includeArchived: true }
      : seasonSel === "unclassified"
        ? { allHistory: false, includeUnclassified: true, includeArchived: true, seasonYear: -1 }
        : picked
          ? { allHistory: false, includeUnclassified: false, includeArchived: true, season: picked.name, seasonYear: picked.year }
          : { allHistory: false, includeUnclassified: false, includeArchived: true, seasonYear: Number(seasonSel) || profile.target_year };
  const sel = cohortFilter(apps, cohort);
  // "unclassified" view shows only unclassified rows (cohort season -1 matches nothing classified).
  const cohortApps = sel.apps;
  const total = submittedCount(apps, cohort);
  const pipeline = pipelineCounts(cohortApps);
  const weekly = weeklyApplications(cohortApps, tz, 12, now);
  const idsInCohort = new Set(cohortApps.map((a) => a.id));
  const off = offerRate(
    cohortApps,
    offers.filter((o) => idsInCohort.has(o.application_id)),
  );
  const interviewN = interviewCount(
    cohortApps,
    interviews,
    statusEvents.map((e) => ({ application_id: e.application_id, to_status: e.new_status as AppRow["status"] })),
  );
  const partial = cohortApps.filter(
    (a) => a.status !== "saved" && a.status !== "prepared" && (a.submission_date_unknown || a.submitted_precision !== "day"),
  ).length;

  const trashed = new Set(apps.filter((a) => a.trashed_at).map((a) => a.id));
  const names = new Map(apps.map((a) => [a.id, a.company_name]));
  const open = sortTasks(
    tasks.filter((t) => t.state === "pending" && !(t.application_id && trashed.has(t.application_id))),
    now,
    tz,
  )
    .map((t) => ({ t, cls: classifyTask(t, now, tz) }))
    .filter((x) => x.cls === "overdue" || x.cls === "today" || x.cls === "next7");

  const sources = health.data ?? [];
  const lastOk = sources
    .map((s) => s.last_success_at)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;
  const stale = sources.length === 0 || sources.some((s) => s.stale);
  const newJobs = feed.filter(
    (f) => !f.applied && !f.userJob?.hidden && now.getTime() - new Date(f.job.first_seen_at).getTime() <= 7 * 86400_000,
  );
  const s = practice.summary;

  const SEGMENT: Record<string, string> = {
    applied: "bg-sky-400",
    screening: "bg-indigo-400",
    assessment: "bg-violet-400",
    interview: "bg-amber-400",
    offer: "bg-emerald-400",
    accepted: "bg-emerald-300",
    rejected: "bg-rose-400",
    withdrawn: "bg-zinc-400",
    ghosted: "bg-zinc-500",
  };
  const segments = STATUSES.filter((st) => st !== "saved" && st !== "prepared" && pipeline[st] > 0);

  const upNext = (
    <Card>
      <CardHeader>
        <CardTitle>Up next</CardTitle>
        <CardDescription>Overdue first, then today and the next 7 days.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due. Add a follow-up from any application.</p>
        ) : (
          open.slice(0, 5).map(({ t, cls }) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/5 p-3 text-sm">
              <span>
                {t.application_id ? (
                  <Link className="font-medium underline-offset-2 hover:underline" href={`/applications/${t.application_id}`}>
                    {names.get(t.application_id) ?? "Application"}
                  </Link>
                ) : (
                  "General"
                )}{" "}
                <span className="text-muted-foreground">· {t.kind.replace(/_/g, " ")}</span>
              </span>
              <span className="flex items-center gap-2 text-xs">
                <Badge variant={cls === "overdue" ? "destructive" : "outline"}>{cls === "next7" ? "next 7 days" : cls}</Badge>
                {t.due_date ? fmtDateOnly(t.due_date) : fmtInstant(t.due_at, tz)}
              </span>
            </div>
          ))
        )}
        {open.length > 5 ? <p className="text-xs text-muted-foreground">+{open.length - 5} more due soon</p> : null}
      </CardContent>
    </Card>
  );

  const jobsCard = (
    <Card>
      <CardHeader>
        <CardTitle>New this week</CardTitle>
        <CardDescription>
          {newJobs.length} new listing{newJobs.length === 1 ? "" : "s"} matching your saved filters
          {lastOk ? "" : " · no refresh yet"}
          {stale && lastOk ? " · list is stale" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {newJobs.slice(0, 5).map((f) => (
          <Link
            key={f.job.id}
            href={`/jobs/${f.job.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/5 p-3 text-sm transition-colors hover:bg-white/10"
          >
            <span className="flex min-w-0 items-center gap-3">
              <CompanyLogo company={f.job.company} applyUrl={f.job.apply_url} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{f.job.company}</span>
                <span className="block truncate text-xs text-muted-foreground">{f.job.title}</span>
              </span>
            </span>
          </Link>
        ))}
        {newJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing new right now.</p>
        ) : (
          <Link className="text-sm underline-offset-2 hover:underline" href="/jobs">
            See all listings
          </Link>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={name ? `Hey ${name}!` : "Hey there!"}
        actions={
          apps.length > 0 ? (
            <>
              <AutoSubmitForm method="get" action="/dashboard">
                <NativeSelect
                  name="season"
                  defaultValue={picked || ["all", "unclassified"].includes(seasonSel) ? seasonSel : targetKey}
                  aria-label="Season view"
                  className="h-9 w-48"
                >
                  {seasons.tabs.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                  <option value="unclassified">Unclassified season{sel.unclassified ? ` (${sel.unclassified})` : ""}</option>
                  <option value="all">All history</option>
                </NativeSelect>
              </AutoSubmitForm>
              <Link href="/applications/new" className={buttonVariants()}>
                New application
              </Link>
            </>
          ) : (
            <Link href="/applications/new" className={buttonVariants()}>
              New application
            </Link>
          )
        }
      />

      {apps.length === 0 ? (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Get started</CardTitle>
              <CardDescription>Three quick steps and this page fills itself in.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  n: 1,
                  title: "Add an application",
                  text: "Track a role you applied to, or one you are preparing.",
                  href: "/applications/new",
                  cta: "Add one",
                },
                {
                  n: 2,
                  title: "Import your old log",
                  text: "Bring a spreadsheet in as CSV. You review every row first.",
                  href: "/applications/import",
                  cta: "Import",
                },
                {
                  n: 3,
                  title: "Browse new listings",
                  text: "Find roles in the shared catalog and track the ones you like.",
                  href: "/jobs",
                  cta: "Open jobs",
                },
              ].map((x) => (
                <div key={x.n} className="grid content-between gap-3 rounded-md bg-white/5 p-4">
                  <div className="grid gap-1">
                    <span className="text-2xl font-light text-primary tabular-nums">{x.n}</span>
                    <p className="font-semibold">{x.title}</p>
                    <p className="text-sm text-muted-foreground">{x.text}</p>
                  </div>
                  <Link href={x.href} className={buttonVariants({ variant: x.n === 1 ? "default" : "outline", size: "sm" })}>
                    {x.cta}
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
          {jobsCard}
        </>
      ) : (
        <>
          <section aria-label="Summary" className="mb-6 rounded-lg bg-card p-4 ring-1 ring-white/10">
            <dl className="grid grid-cols-3 divide-x divide-white/10">
              {[
                {
                  label: "Submitted",
                  value: String(total),
                  hint: `Saved and prepared roles are excluded.${partial ? ` ${partial} have a month-only or unknown date.` : ""}`,
                },
                {
                  label: "Interviews",
                  value: String(interviewN),
                  hint: "Distinct applications with a recorded interview round or status.",
                },
                {
                  label: "Offers",
                  value: String(off.numerator),
                  hint: `${off.numerator} of ${off.denominator} submitted${off.rate == null ? "" : ` (${Math.round(off.rate * 100)}%)`}.`,
                },
              ].map((x) => (
                <div key={x.label} className="grid gap-1 px-4 first:pl-0 last:pr-0" title={x.hint}>
                  <dt className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{x.label}</dt>
                  <dd className="text-4xl font-light tracking-tight tabular-nums">{x.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4">
              {segments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No submitted applications in this view yet.</p>
              ) : (
                <>
                  <div
                    role="img"
                    aria-label={`Pipeline: ${segments.map((st) => `${STATUS_LABEL[st as Status]} ${pipeline[st]}`).join(", ")}`}
                    className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm"
                  >
                    {segments.map((st) => (
                      <span
                        key={st}
                        title={`${STATUS_LABEL[st as Status]}: ${pipeline[st]}`}
                        className={cn("h-full min-w-1.5 transition-opacity hover:opacity-80", SEGMENT[st])}
                        style={{ flexGrow: pipeline[st] }}
                      />
                    ))}
                  </div>
                  <ul className="sr-only">
                    {segments.map((st) => (
                      <li key={st}>
                        {STATUS_LABEL[st as Status]}: {pipeline[st]}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {upNext}
            {jobsCard}
          </div>

          <details className="mt-6 rounded-lg bg-card ring-1 ring-white/10">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              More
            </summary>
            <div className="grid gap-6 border-t border-white/10 p-4">
              <div>
                <h2 className="mb-1 text-base">Applications per week</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Weeks start Monday. {weekly.unallocated} with a month-only or unknown date are not placed in a week.
                </p>
                <BarSeriesChart
                  title="Applications submitted per week"
                  valueLabel="Submitted"
                  height={200}
                  data={weekly.weeks.map((w) => ({ label: fmtWeek(w.weekStart), value: w.count }))}
                />
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Practice:</span> {s.thisWeek.attempts} of {s.thisWeek.goal} attempts this week ·{" "}
                {s.dueReviews.length} review
                {s.dueReviews.length === 1 ? "" : "s"} due ·{" "}
                <Link className="underline underline-offset-2" href="/practice">
                  Open practice log
                </Link>
              </p>
            </div>
          </details>
        </>
      )}
    </>
  );
}
