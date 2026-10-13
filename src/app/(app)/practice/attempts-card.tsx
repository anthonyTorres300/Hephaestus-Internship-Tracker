"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/page-header";
import { ExternalLink } from "@/components/shared/external-link";
import type { PracticeAttempt, PracticeProblem } from "@/lib/data/types";
import { fmtDateOnly, fmtInstant } from "@/lib/ui/format";
import { deleteAttemptAction } from "./actions";

export type LoggedAttempt = { attempt: PracticeAttempt; problem: PracticeProblem | null; topics: string[] };
const PAGE_SIZE = 6;
const RESULT_LABEL = {
  solved_independently: "Solved independently",
  solved_with_hints: "Solved with hints",
  reviewed_solution: "Reviewed solution",
  unsolved: "Unsolved",
} as const;
const LABEL = "text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

function AttemptDetails({ entry, tz }: { entry: LoggedAttempt; tz: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { attempt, problem, topics } = entry;
  const title = problem?.title ?? "Problem";
  const when = fmtInstant(attempt.practiced_at, tz);
  const fields = [
    { label: "Result", value: RESULT_LABEL[attempt.result] },
    { label: "Practiced", value: when },
    { label: "Difficulty", value: problem?.difficulty && problem.difficulty !== "unknown" ? problem.difficulty : "Not recorded" },
    {
      label: "Time spent",
      value: attempt.duration_unknown ? "Unknown" : attempt.duration_minutes != null ? `${attempt.duration_minutes} min` : "Not recorded",
    },
    { label: "Confidence", value: attempt.confidence != null ? `${attempt.confidence}/5` : "Not rated" },
    { label: "Language", value: attempt.language || "Not recorded" },
    { label: "Next review", value: attempt.next_review_date ? fmtDateOnly(attempt.next_review_date) : "Not scheduled" },
  ];
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`View attempt for ${title} on ${when}`}
        className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-md p-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">
            {when}
            {attempt.duration_minutes != null && !attempt.duration_unknown ? ` · ${attempt.duration_minutes} min` : ""}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {attempt.notes?.trim() ? (
              <>
                <FileText aria-hidden className="size-3" /> Notes saved ·{" "}
              </>
            ) : null}
            View details
          </span>
        </span>
        <Badge variant={attempt.result === "solved_independently" ? "secondary" : "outline"}>{RESULT_LABEL[attempt.result]}</Badge>
      </DialogTrigger>
      <DialogContent initialFocus={titleRef} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="pr-7">
          <DialogTitle ref={titleRef} tabIndex={-1} className="break-words outline-none">
            {title}
          </DialogTitle>
          <DialogDescription>Logged attempt · times shown in {tz}.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="grid min-w-0 gap-1">
              <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
              <dd className="text-sm break-words first-letter:uppercase">{field.value}</dd>
            </div>
          ))}
          <div className="grid gap-1 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Problem topics</dt>
            <dd className="flex flex-wrap gap-1.5">
              {topics.length ? (
                topics.map((topic) => (
                  <Badge key={topic} variant="outline">
                    {topic}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No topics recorded</span>
              )}
            </dd>
          </div>
        </dl>
        <section aria-label="Attempt notes" className="grid gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Notes</h3>
          {attempt.notes?.trim() ? (
            <p className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {attempt.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes saved for this attempt.</p>
          )}
        </section>
        {problem?.url ? (
          <div className="text-sm">
            <ExternalLink href={problem.url}>Open problem</ExternalLink>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AttemptsCard({ entries, tz }: { entries: LoggedAttempt[]; tz: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(entries.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const start = currentPage * PAGE_SIZE;
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <h2 className={LABEL}>Logged attempts</h2>
        {entries.length === 0 ? (
          <EmptyState title="No attempts yet">Use “Log attempt” after your next problem.</EmptyState>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Select an attempt to read your notes and details. Latest first.</p>
            <ul aria-label="Logged attempts" className="grid">
              {entries.slice(start, start + PAGE_SIZE).map((entry) => (
                <li
                  key={entry.attempt.id}
                  className="flex min-w-0 items-center gap-1 border-t border-border/50 py-2 text-sm first:border-t-0"
                >
                  <AttemptDetails entry={entry} tz={tz} />
                  <form action={deleteAttemptAction} className="shrink-0">
                    <input type="hidden" name="id" value={entry.attempt.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete attempt for ${entry.problem?.title ?? "problem"}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <nav
                aria-label="Attempt history pages"
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3"
              >
                <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
                  {start + 1}–{Math.min(start + PAGE_SIZE, entries.length)} of {entries.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Newer attempts"
                  >
                    <ChevronLeft aria-hidden /> Newer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === pages - 1}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="Older attempts"
                  >
                    Older <ChevronRight aria-hidden />
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
