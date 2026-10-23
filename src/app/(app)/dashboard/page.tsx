import { TaskControls, CreateFollowUp } from "./task-controls";
import { localDateIn } from "@/lib/domain/dates";
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
    fetchAll<AppRow & { company_name: string; role_title: string }>(
      supabase,
      "applications",
      "id",
      "id,status,company_name,role_title,submitted_precision,submitted_year,submitted_month,submitted_day,submission_date_unknown,season,season_year,trashed_at,archived_at",
    ),
    fetchAll<{ application_id: string }>(supabase, "offer_events", "id", "application_id"),
    fetchAll<{ application_id: string }>(supabase, "interview_events", "id", "application_id"),
    fetchAll<{
      application_id: string;
      new_status: string;
      effective_at: string | null;
      effective_at_unknown: boolean;
      recorded_at: string;
    }>(supabase, "application_status_events", "recorded_at", "application_id,new_status,effective_at,effective_at_unknown,recorded_at"),
    fetchAll<Task>(supabase, "tasks"),
    loadPractice(supabase, tz, profile.weekly_practice_goal, now),
    loadFeed(
      supabase,
      profile,
      {
        firstSeenAfter: new Date(now.getTime() - 7 * 86400_000).toISOString(),
        season: "target",
        sort: "relevance",
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
  const pipeline = pipelineCounts(cohortApps.filter((a) => !a.archived_at));
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
  const focusStatuses: Status[] = ["screening", "assessment", "interview", "offer"];
  const applicationsToWatch = focusStatuses.map((status) => ({
    status,
    count: cohortApps.filter((app) => !app.archived_at && app.status === status).length,
    apps: cohortApps.filter((app) => !app.archived_at && app.status === status).slice(0, 3),
  }));

  const progressRank: Partial<Record<Status, number>> = {
    applied: 1,
    screening: 2,
    assessment: 3,
    interview: 4,
    offer: 5,
    accepted: 6,
  };
  const progressLabel: Record<number, string> = {
    1: "Application submitted",
    2: "Screening",
    3: "Assessment",
    4: "Interview",
    5: "Offer",
    6: "Offer accepted",
  };
  const furthestByApplication = new Map<string, Status>();
  const considerProgress = (id: string, rawStatus: string) => {
    if (!STATUSES.includes(rawStatus as Status)) return;
    const status = rawStatus as Status;
    const rank = progressRank[status] ?? 0;
    const currentRank = progressRank[furthestByApplication.get(id) ?? "saved"] ?? 0;
    if (rank > currentRank) furthestByApplication.set(id, status);
  };
  for (const app of apps) considerProgress(app.id, app.status);
  for (const event of statusEvents) considerProgress(event.application_id, event.new_status);

  const targetLabel = seasons.tabs.find((tab) => tab.key === targetKey)?.label ?? targetKey;
  const targetApps = apps.filter(
    (app) => !app.trashed_at && app.season === profile.target_season && app.season_year === profile.target_year,
  );
  const previousApps = apps.filter((app) => {
    if (app.trashed_at || !app.season || app.season_year == null) return false;
    if (app.season_year !== profile.target_year) return app.season_year < profile.target_year;
    const seasonOrder = ["winter", "spring", "summer", "fall"];
    return seasonOrder.indexOf(app.season) < seasonOrder.indexOf(profile.target_season);
  });
  const submittedApps = (rows: typeof apps) => rows.filter((app) => app.status !== "saved" && app.status !== "prepared");
  const hasReached = (app: (typeof apps)[number], threshold: number) =>
    (progressRank[furthestByApplication.get(app.id) ?? app.status] ?? 0) >= threshold;
  const targetSubmitted = submittedApps(targetApps);
  const previousSubmitted = submittedApps(previousApps);
  const bestProgress = (rows: typeof apps) =>
    submittedApps(rows)
      .map((app) => ({ app, status: furthestByApplication.get(app.id) ?? app.status }))
      .filter(({ status }) => (progressRank[status] ?? 0) > 0)
      .sort((a, b) => (progressRank[b.status] ?? 0) - (progressRank[a.status] ?? 0))[0];
  const targetBest = bestProgress(targetApps);
  const previousBest = bestProgress(previousApps);

  const seasonFunnel = seasons.tabs.map((season) => {
    const seasonSubmitted = submittedApps(
      apps.filter((app) => !app.trashed_at && app.season === season.name && app.season_year === season.year),
    );
    return {
      ...season,
      submitted: seasonSubmitted.length,
      stages: [
        { label: "Screening", threshold: 2 },
        { label: "Assessment", threshold: 3 },
        { label: "Interview", threshold: 4 },
        { label: "Offer", threshold: 5 },
      ].map(({ label, threshold }) => {
        const reached = seasonSubmitted.filter((app) => hasReached(app, threshold)).length;
        return { label, reached, rate: seasonSubmitted.length ? Math.round((reached / seasonSubmitted.length) * 100) : 0 };
      }),
    };
  });

  const latestStageDate = new Map<string, string>();
  const latestStageRecordedAt = new Map<string, string>();
  for (const event of statusEvents) {
    const date = !event.effective_at_unknown && event.effective_at ? event.effective_at : event.recorded_at;
    const previousRecordedAt = latestStageRecordedAt.get(event.application_id);
    if (!previousRecordedAt || Date.parse(event.recorded_at) >= Date.parse(previousRecordedAt)) {
      latestStageDate.set(event.application_id, date);
      latestStageRecordedAt.set(event.application_id, event.recorded_at);
    }
  }
  const today = localDateIn(now, tz);
  const upcomingFollowUpIds = new Set(
    tasks
      .filter((task) => {
        if (task.state !== "pending" || task.kind !== "follow_up" || !task.application_id) return false;
        if (task.due_date) return task.due_date >= today;
        return task.due_at ? Date.parse(task.due_at) >= now.getTime() : false;
      })
      .map((task) => task.application_id!),
  );
  const needsAttention = cohortApps
    .filter((app) => {
      if (app.archived_at || !["applied", "screening", "assessment", "interview", "offer"].includes(app.status)) return false;
      if (upcomingFollowUpIds.has(app.id)) return false;
      const changedAt = latestStageDate.get(app.id);
      return !!changedAt && now.getTime() - Date.parse(changedAt) >= 14 * 86400_000;
    })
    .map((app) => ({
      app,
      changedAt: latestStageDate.get(app.id)!,
      days: Math.floor((now.getTime() - Date.parse(latestStageDate.get(app.id)!)) / 86400_000),
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const upNext = (
    <Card>
      <CardHeader>
        <CardTitle>Up next</CardTitle>
        <CardDescription>Overdue first, then today and the next 7 days.</CardDescription>
        <CreateFollowUp
          apps={cohortApps.filter((a) => !a.trashed_at).map((a) => ({ id: a.id, label: `${a.company_name} — ${a.role_title}` }))}
          today={localDateIn(now, tz)}
        />
      </CardHeader>
      <CardContent className="grid max-h-[32rem] gap-2 overflow-y-auto">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due. Add a follow-up from any application.</p>
        ) : (
          open.map(({ t, cls }) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 p-3 text-sm">
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
              <TaskControls id={t.id} applicationId={t.application_id} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  const jobsCard = (
    <Card>
      <CardHeader>
        <CardTitle>Your shortlist</CardTitle>
        <CardDescription>
          Top matches from {newJobs.length} new listing{newJobs.length === 1 ? "" : "s"} this week
          {lastOk ? "" : " · no refresh yet"}
          {stale && lastOk ? " · list is stale" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {newJobs.slice(0, 5).map((f) => (
          <Link
            key={f.job.id}
            href={`/jobs/${f.job.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 p-3 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-3">
              <CompanyLogo company={f.job.company} applyUrl={f.job.apply_url} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{f.job.company}</span>
                <span className="block text-xs text-muted-foreground">{f.job.title}</span>
                <span className="mt-1 block text-xs text-primary">
                  {f.score.components
                    .filter((c) => c.points > 0 && c.name !== "recency")
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 2)
                    .map((c) => c.explanation)
                    .join(" · ") || "Matches your selected role and season"}
                </span>
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

      <section aria-labelledby="applications-to-watch" className="mb-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="applications-to-watch" className="text-lg font-semibold tracking-tight">
              Applications to watch
            </h2>
            <p className="text-sm text-muted-foreground">Your active applications in later stages of the process.</p>
          </div>
          <Link className="text-sm underline-offset-2 hover:underline" href="/applications?layout=list">
            View all applications
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {applicationsToWatch.map(({ status, count, apps: stageApps }) => (
            <Card key={status} className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardDescription>{STATUS_LABEL[status]}</CardDescription>
                <CardTitle className="text-3xl font-light tabular-nums">{count}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 px-4">
                {stageApps.length ? (
                  <>
                    {stageApps.map((app) => (
                      <Link
                        key={app.id}
                        href={`/applications/${app.id}`}
                        className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <CompanyLogo company={app.company_name} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{app.company_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{app.role_title}</span>
                        </span>
                      </Link>
                    ))}
                    {count > stageApps.length && (
                      <Link
                        href={`/applications?status=${status}&layout=list`}
                        className="px-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        +{count - stageApps.length} more
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No applications here yet.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Season progress</CardTitle>
          <CardDescription>See how far your applications have progressed compared with earlier seasons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            { label: targetLabel, rows: targetApps, submitted: targetSubmitted, best: targetBest },
            { label: "Earlier seasons", rows: previousApps, submitted: previousSubmitted, best: previousBest },
          ].map(({ label, rows, submitted: submittedRows, best }) => (
            <div key={label} className="rounded-lg bg-muted/60 p-4">
              <h3 className="font-semibold">{label}</h3>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No applications recorded yet.</p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Submitted", value: submittedRows.length },
                    { label: "Screening+", value: submittedRows.filter((app) => hasReached(app, 2)).length },
                    { label: "Interview+", value: submittedRows.filter((app) => hasReached(app, 4)).length },
                  ].map((metric) => (
                    <div key={metric.label}>
                      <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                      <dd className="mt-1 text-2xl font-light tabular-nums">{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {best && (
                <p className="mt-4 border-t border-border pt-3 text-sm">
                  Furthest: <span className="font-medium">{progressLabel[progressRank[best.status] ?? 1]}</span>
                  <span className="text-muted-foreground"> with </span>
                  <Link className="font-medium underline-offset-2 hover:underline" href={`/applications/${best.app.id}`}>
                    {best.app.company_name} · {best.app.role_title}
                  </Link>
                </p>
              )}
            </div>
          ))}
          {targetBest && previousBest && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {`This season, your furthest progress is ${progressLabel[progressRank[targetBest.status] ?? 1]}. `}
              {progressRank[targetBest.status] === progressRank[previousBest.status]
                ? "That matches your best from earlier seasons."
                : (progressRank[targetBest.status] ?? 0) > (progressRank[previousBest.status] ?? 0)
                  ? "That’s further than your best in earlier seasons."
                  : `You reached ${progressLabel[progressRank[previousBest.status] ?? 1]} in an earlier season; there’s still time to match or pass it.`}
            </p>
          )}
          <div className="sm:col-span-2">
            <h3 className="mb-1 font-semibold">Conversion by season</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Share of submitted applications that reached each stage, based on status history.
            </p>
            {seasonFunnel.length ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Season
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Submitted
                      </th>
                      {seasonFunnel[0].stages.map((stage) => (
                        <th key={stage.label} scope="col" className="px-3 py-2 text-right font-medium">
                          {stage.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {seasonFunnel.map((season) => (
                      <tr key={season.key}>
                        <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                          {season.label}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{season.submitted}</td>
                        {season.stages.map((stage) => (
                          <td key={stage.label} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {season.submitted ? `${stage.reached} · ${stage.rate}%` : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add a season to start comparing conversion rates.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Applications needing attention</CardTitle>
          <CardDescription>Active applications with no status update in 14 days and no upcoming follow-up reminder.</CardDescription>
          <CreateFollowUp
            apps={needsAttention.map(({ app }) => ({ id: app.id, label: `${app.company_name} — ${app.role_title}` }))}
            today={today}
          />
        </CardHeader>
        <CardContent className="grid gap-2">
          {needsAttention.length ? (
            needsAttention.map(({ app, changedAt, days }) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 p-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {app.company_name} · {app.role_title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {STATUS_LABEL[app.status]} · unchanged since {fmtInstant(changedAt, tz)}
                  </span>
                </span>
                <Badge variant="outline">{days} days</Badge>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nothing is waiting without a follow-up right now.</p>
          )}
        </CardContent>
      </Card>

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
                <div key={x.n} className="grid content-between gap-3 rounded-md bg-muted/60 p-4">
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
          <section aria-label="Summary" className="mb-6 rounded-lg bg-card p-4 ring-1 ring-border">
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
                  <dd className="text-3xl sm:text-4xl font-light tracking-tight tabular-nums">{x.value}</dd>
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
                  <p className="mt-3 text-xs text-muted-foreground">Active application pipeline</p>
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                    {segments.map((st) => (
                      <li key={st}>
                        <Link
                          href={`/applications?season=${encodeURIComponent(seasonSel === "all" ? "all" : seasonSel)}&status=${st}&layout=list`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-muted/60 px-3 hover:bg-muted"
                        >
                          <span className={cn("size-2 rounded-full", SEGMENT[st])} aria-hidden />
                          {STATUS_LABEL[st as Status]}: {pipeline[st]}
                        </Link>
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

          <details className="mt-6 rounded-lg bg-card ring-1 ring-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              More
            </summary>
            <div className="grid gap-6 border-t border-border p-4">
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
