import { ApplyLink } from "@/components/applications/quick-log";
import { BackToList } from "@/components/layout/browse-context";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { getApplicationDetail } from "@/lib/data/applications";
import { seasonLabel } from "@/lib/ui/format";
import { loadSeasons } from "@/lib/data/seasons";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CompanyLogo } from "@/components/shared/company-logo";
import { SafeMarkdown } from "@/components/shared/safe-markdown";
import { ExternalLink } from "@/components/shared/external-link";
import { classifyTask, formatPartialDate, STATUS_LABEL, type Status } from "@/lib/domain";
import { fmtDateOnly, fmtInstant, submissionLabel } from "@/lib/ui/format";
import { ArrowRight, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { ApplicationForm } from "../application-form";
import { InterviewForm, NoteEditForm, NoteForm, StatusForm, TaskForm } from "../detail-forms";
import { deleteInterviewAction, deleteNoteAction, lifecycleAction, taskTransitionAction, updateInterviewOutcomeAction } from "../actions";

export const metadata = { title: "Application" };

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireWorkspace();
  const [d, seasons] = await Promise.all([
    getApplicationDetail(supabase, id),
    loadSeasons(supabase, { season: profile.target_season, year: profile.target_year }),
  ]);
  if (!d) notFound();
  const { app, events, notes, interviews, offers, tasks, job } = d;
  const now = new Date();
  const tz = profile.timezone;
  const trashed = !!app.trashed_at;
  const timelineEvents = [...events].reverse();

  const life = (op: string, label: string, variant: "outline" | "destructive" = "outline") => (
    <form action={lifecycleAction}>
      <input type="hidden" name="id" value={app.id} />
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="revision" value={app.revision} />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </form>
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3 sm:gap-4">
            <CompanyLogo company={app.company_name} applyUrl={app.application_url} size="md" />
            <span className="min-w-0">
              {app.company_name} — {app.role_title}
            </span>
          </span>
        }
        description={`${submissionLabel(app)} · Priority ${app.priority}${app.season_year ? ` · ${seasonLabel(app.season, app.season_year)}` : ""}`}
        actions={
          <>
            <StatusBadge status={app.status} />
            {trashed ? (
              life("restore", "Restore")
            ) : (
              <>
                {app.archived_at ? life("unarchive", "Unarchive") : life("archive", "Archive")}
                {life("trash", "Move to trash")}
              </>
            )}
            <BackToList section="applications" />
          </>
        }
      />
      {trashed ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        >
          This application is in the trash. Restore it, or permanently delete it (this also removes its notes, timeline, interviews and
          tasks).
          <form action={lifecycleAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={app.id} />
            <input type="hidden" name="op" value="delete" />
            <input type="hidden" name="revision" value={app.revision} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" required className="size-4" /> I understand this cannot be undone.
            </label>
            <Button type="submit" variant="destructive" size="sm">
              Delete permanently
            </Button>
          </form>
        </div>
      ) : null}

      <div className="grid gap-4">
        <section aria-label="Application timeline">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card">
            <CardHeader className="border-b border-border pb-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <CardTitle className="text-lg">Application timeline</CardTitle>
                <CardDescription>Every recorded step in this application’s journey.</CardDescription>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0">
                <Badge variant="outline" className="border-border bg-background/50">
                  {events.length} update{events.length === 1 ? "" : "s"}
                </Badge>
                <StatusBadge status={app.status} />
              </div>
            </CardHeader>
            <CardContent className="pt-5 sm:pt-6">
              {timelineEvents.length === 0 ? (
                <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-6 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <CalendarDays aria-hidden className="size-5" />
                  </span>
                  <p className="font-medium">Your timeline starts here</p>
                  <p className="text-sm text-muted-foreground">Status changes will appear here as your application moves forward.</p>
                </div>
              ) : (
                <ol className="grid">
                  {timelineEvents.map((e, index) => {
                    const latest = index === 0;
                    const newLabel = STATUS_LABEL[e.new_status as Status] ?? e.new_status;
                    const oldLabel = e.old_status ? (STATUS_LABEL[e.old_status as Status] ?? e.old_status) : null;
                    return (
                      <li
                        key={e.id}
                        className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0 sm:grid-cols-[1.25rem_minmax(0,1fr)] sm:gap-4"
                      >
                        <div className="relative flex justify-center">
                          {index < timelineEvents.length - 1 ? (
                            <span aria-hidden className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 to-white/10" />
                          ) : null}
                          <span
                            aria-hidden
                            className={`relative z-10 mt-4 size-3 shrink-0 rounded-full border-2 ${
                              latest ? "border-primary bg-primary ring-4 ring-primary/15" : "border-border bg-card"
                            }`}
                          />
                        </div>
                        <div
                          className={`rounded-xl border p-4 transition-colors sm:p-5 ${
                            latest
                              ? "border-primary/35 bg-gradient-to-br from-primary/[0.07] to-background/60 shadow-lg shadow-black/10"
                              : "border-border bg-background/35 hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase ${latest ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {latest ? <Sparkles aria-hidden className="size-3.5" /> : null}
                              {latest ? "Latest update" : "Status update"}
                            </span>
                            <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground capitalize">
                              {e.origin.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {oldLabel ? (
                              <Badge variant="outline" className="border-border bg-background/60 text-muted-foreground">
                                {oldLabel}
                              </Badge>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">Application created</span>
                            )}
                            {oldLabel ? <ArrowRight aria-hidden className="size-4 text-muted-foreground/70" /> : null}
                            {STATUS_LABEL[e.new_status as Status] ? (
                              <StatusBadge status={e.new_status as Status} />
                            ) : (
                              <Badge variant="outline">{newLabel}</Badge>
                            )}
                          </div>
                          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays aria-hidden className="size-3.5 text-primary/80" />
                              {e.effective_at_unknown || !e.effective_at ? "Effective date unknown" : fmtInstant(e.effective_at, tz)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 aria-hidden className="size-3.5" />
                              Recorded {fmtInstant(e.recorded_at, tz)}
                            </span>
                          </div>
                          {e.reason ? (
                            <p className="mt-3 rounded-md border-l-2 border-primary/50 bg-background/45 px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
                              {e.reason}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
                Imported applications begin with a snapshot, so earlier history may not be available.
              </p>
            </CardContent>
          </Card>
        </section>

        <details className="group rounded-lg border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Application details
              <span className="text-xs font-normal text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                  <CardDescription>
                    {job ? (
                      <>
                        Linked listing:{" "}
                        <Link className="underline" href={`/jobs/${job.id}`}>
                          {job.company} — {job.title}
                        </Link>
                        .{" "}
                      </>
                    ) : null}
                    {app.original_status ? `Imported status label: “${app.original_status}”. ` : null}
                    {app.original_application_date ? `Original date text: “${app.original_application_date}”.` : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {app.application_url ? (
                      <ApplyLink
                        intent={{
                          application_url: app.application_url,
                          applicationId: app.id,
                          company_name: app.company_name,
                          role_title: app.role_title,
                        }}
                        className="underline"
                      >
                        Application link
                      </ApplyLink>
                    ) : null}
                    {app.portal_url ? <ExternalLink href={app.portal_url}>Progress portal</ExternalLink> : null}
                  </div>
                  {!trashed ? (
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-medium">Edit details</summary>
                      <div className="mt-4">
                        <ApplicationForm
                          mode="edit"
                          seasons={seasons.tabs.map((t) => ({ key: t.key, label: t.label }))}
                          defaultYear={profile.target_year}
                          initial={{ ...app, locations: Array.isArray(app.locations) ? (app.locations as string[]) : [] }}
                        />
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
              {!trashed ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Change status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatusForm id={app.id} revision={app.revision} current={app.status} idem={randomUUID()} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </details>

        <details className="group rounded-lg border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Notes{notes.length ? ` (${notes.length})` : ""}
              <span className="text-xs font-normal text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {!trashed ? <NoteForm applicationId={app.id} /> : null}
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  <ul className="grid gap-4">
                    {notes.map((n) => (
                      <li key={n.id} className="grid gap-2 rounded-lg border p-3">
                        <SafeMarkdown>{n.body}</SafeMarkdown>
                        <p className="text-xs text-muted-foreground">
                          Added {fmtInstant(n.created_at, tz)}
                          {n.updated_at !== n.created_at ? ` · edited ${fmtInstant(n.updated_at, tz)}` : ""}
                        </p>
                        {!trashed ? (
                          <div className="flex flex-wrap items-start gap-2">
                            <details className="flex-1">
                              <summary className="cursor-pointer text-xs underline">Edit</summary>
                              <div className="mt-2">
                                <NoteEditForm id={n.id} applicationId={app.id} body={n.body} />
                              </div>
                            </details>
                            <form action={deleteNoteAction}>
                              <input type="hidden" name="id" value={n.id} />
                              <input type="hidden" name="application_id" value={app.id} />
                              <Button type="submit" variant="ghost" size="xs">
                                Delete
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </details>

        <details className="group rounded-lg border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              <span>Interviews & tasks</span>
              <span className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                {interviews.length} rounds · {tasks.length} tasks
                <span className="transition-transform group-open:rotate-180">⌄</span>
              </span>
            </span>
          </summary>
          <div className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Interviews</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {interviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No interview rounds recorded.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {interviews.map((i) => (
                        <li key={i.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                          <span className="font-medium">
                            Round {i.round_number}
                            {i.round_type ? ` · ${i.round_type}` : ""}{" "}
                            <Badge variant="outline" className="ml-1 capitalize">
                              {i.outcome}
                            </Badge>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {i.scheduled_at
                              ? fmtInstant(i.scheduled_at, i.timezone ?? tz)
                              : i.date_precision !== "unknown"
                                ? formatPartialDate({
                                    precision: i.date_precision as "day",
                                    year: i.event_year ?? undefined,
                                    month: i.event_month ?? undefined,
                                    day: i.event_day ?? undefined,
                                  })
                                : "Date not recorded"}
                            {i.raw_value ? ` · imported as “${i.raw_value}”` : ""}
                          </span>
                          {i.notes ? <span className="text-xs">{i.notes}</span> : null}
                          <div className="flex flex-wrap gap-2">
                            <form action={updateInterviewOutcomeAction} className="flex gap-1">
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="application_id" value={app.id} />
                              <select
                                name="outcome"
                                defaultValue={i.outcome}
                                aria-label="Outcome"
                                className="h-6 rounded border bg-background px-1 text-xs"
                              >
                                {["pending", "passed", "failed", "cancelled", "unknown"].map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" variant="outline" size="xs">
                                Set
                              </Button>
                            </form>
                            <form action={deleteInterviewAction}>
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="application_id" value={app.id} />
                              <Button type="submit" variant="ghost" size="xs">
                                Delete
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!trashed ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Add a round</summary>
                      <div className="mt-3">
                        <InterviewForm applicationId={app.id} timezone={tz} />
                      </div>
                    </details>
                  ) : null}
                  {offers.length ? (
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">Offer evidence</p>
                      {offers.map((o) => (
                        <p key={o.id} className="text-xs text-muted-foreground">
                          {o.date_precision === "unknown"
                            ? "Offer recorded, date unknown"
                            : `Offer received ${formatPartialDate({ precision: o.date_precision, year: o.received_year ?? undefined, month: o.received_month ?? undefined, day: o.received_day ?? undefined })}`}
                          {o.needs_review ? " · needs review" : ""}
                          {o.raw_value ? ` · source text “${o.raw_value}”` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>Shown in the app only; nothing is emailed.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {tasks.map((t) => {
                        const cls = classifyTask(t, now, tz);
                        return (
                          <li key={t.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                            <span className="flex flex-wrap items-center gap-2 font-medium">
                              {t.kind.replace(/_/g, " ")}
                              <Badge variant={cls === "overdue" ? "destructive" : "outline"}>
                                {cls === "closed" ? t.state : cls === "next7" ? "next 7 days" : cls}
                              </Badge>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Due {t.due_date ? fmtDateOnly(t.due_date) : fmtInstant(t.due_at, tz)} ·{" "}
                              {t.source === "source_claim" ? "stated by listing" : "set by you"}
                              {t.evidence ? ` (${t.evidence})` : ""}
                            </span>
                            {t.note ? <span className="text-xs">{t.note}</span> : null}
                            <form action={taskTransitionAction} className="flex flex-wrap gap-1">
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="application_id" value={app.id} />
                              {t.state === "pending" ? (
                                <>
                                  <Button name="op" value="complete" size="xs" variant="outline">
                                    Complete
                                  </Button>
                                  <Button name="op" value="snooze" size="xs" variant="outline">
                                    Snooze 1 day
                                  </Button>
                                  <Button name="op" value="dismiss" size="xs" variant="ghost">
                                    Dismiss
                                  </Button>
                                </>
                              ) : (
                                <Button name="op" value="reopen" size="xs" variant="outline">
                                  Reopen
                                </Button>
                              )}
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!trashed ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Add a task</summary>
                      <div className="mt-3">
                        <TaskForm applicationId={app.id} timezone={tz} />
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
