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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { SafeMarkdown } from "@/components/shared/safe-markdown";
import { ExternalLink } from "@/components/shared/external-link";
import { classifyTask, formatPartialDate, STATUS_LABEL, type Status } from "@/lib/domain";
import { fmtDateOnly, fmtInstant, submissionLabel } from "@/lib/ui/format";
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
        title={`${app.company_name} — ${app.role_title}`}
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

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList className="h-11 w-full justify-start overflow-x-auto rounded-md bg-white/5 p-1 sm:w-fit">
          {[
            ["overview", "Overview"],
            ["timeline", "Timeline"],
            ["notes", `Notes${notes.length ? ` (${notes.length})` : ""}`],
            ["activity", "Interviews & tasks"],
          ].map(([v, label]) => (
            <TabsTrigger key={v} value={v} className="rounded-md px-4 data-active:bg-primary/20 data-active:text-primary">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
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
                  {app.application_url ? <ExternalLink href={app.application_url}>Application link</ExternalLink> : null}
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
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Append-only. Imported applications start with one snapshot event; history is never invented.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                {[...events].reverse().map((e) => (
                  <li key={e.id} className="grid gap-0.5 border-l-2 pl-3 text-sm">
                    <span className="font-medium">
                      {e.old_status ? `${STATUS_LABEL[e.old_status as Status] ?? e.old_status} → ` : "Created as "}
                      {STATUS_LABEL[e.new_status as Status] ?? e.new_status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.effective_at_unknown || !e.effective_at ? "Effective time unknown" : `Effective ${fmtInstant(e.effective_at, tz)}`}{" "}
                      · recorded {fmtInstant(e.recorded_at, tz)} · {e.origin}
                    </span>
                    {e.reason ? <span className="text-xs">Reason: {e.reason}</span> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
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
        </TabsContent>

        <TabsContent value="activity">
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
        </TabsContent>
      </Tabs>
    </>
  );
}
