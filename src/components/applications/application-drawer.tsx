"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { SafeMarkdown } from "@/components/shared/safe-markdown";
import { ExternalLink } from "@/components/shared/external-link";
import { NoteForm, StatusForm } from "@/app/(app)/applications/detail-forms";
import { FollowUpShortcuts } from "./follow-up-shortcuts";
import { ApplyLink } from "./quick-log";
import type { DrawerDetail } from "@/lib/applications/types";
import { fmtDateOnly, fmtInstant, submissionLabel } from "@/lib/ui/format";
import { localDateIn } from "@/lib/domain/dates";

export function ApplicationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [detail, setDetail] = useState<DrawerDetail | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setVersion((value) => value + 1);
    router.refresh();
  }, [router]);
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    fetch(`/api/applications/${id}`, { signal: abort.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Could not load this application.");
        if (!abort.signal.aborted) setDetail(data);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load this application.");
      });
    return () => abort.abort();
  }, [id, version]);
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        initialFocus={titleRef}
        className="overflow-y-auto p-4 data-[side=right]:w-full data-[side=right]:sm:w-[36rem] data-[side=right]:sm:max-w-[calc(100vw-2rem)]"
      >
        <SheetHeader className="p-0 pr-8">
          <SheetTitle ref={titleRef} tabIndex={-1} className="break-words outline-none">
            {detail ? `${detail.app.company_name} · ${detail.app.role_title}` : "Application details"}
          </SheetTitle>
          <SheetDescription>Review your application without leaving the list.</SheetDescription>
        </SheetHeader>
        {error ? (
          <div className="grid gap-2">
            <p role="alert">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setVersion((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : !detail ? (
          <p role="status">Loading application…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge status={detail.app.status} />
              <span className="text-muted-foreground">{submissionLabel(detail.app)}</span>
              <Link href={`/applications/${detail.app.id}`} className="ml-auto underline">
                Open full page
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {detail.app.application_url ? (
                <ApplyLink
                  intent={{
                    application_url: detail.app.application_url,
                    applicationId: detail.app.id,
                    company_name: detail.app.company_name,
                    role_title: detail.app.role_title,
                  }}
                  className="underline"
                >
                  Application link
                </ApplyLink>
              ) : null}
              {detail.app.portal_url ? <ExternalLink href={detail.app.portal_url}>Progress portal</ExternalLink> : null}
            </div>
            {!detail.app.trashed_at ? (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">Update status</summary>
                <div className="mt-3">
                  <StatusForm
                    key={detail.app.revision}
                    id={detail.app.id}
                    revision={detail.app.revision}
                    current={detail.app.status}
                    idem={`drawer-${detail.app.id}-${detail.app.revision}`}
                    onSaved={reload}
                  />
                </div>
              </details>
            ) : null}
            <section className="grid gap-3 border-t border-border pt-4" aria-label="Application notes">
              <h3 className="text-base font-medium">Notes</h3>
              {detail.notes.length ? (
                <ul className="grid gap-3">
                  {detail.notes.map((note) => (
                    <li key={note.id} className="grid gap-2 rounded-lg bg-muted/40 p-3">
                      <SafeMarkdown>{note.body}</SafeMarkdown>
                      <span className="text-xs text-muted-foreground">{fmtInstant(note.created_at, detail.timezone)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
              {!detail.app.trashed_at ? <NoteForm applicationId={detail.app.id} onSaved={reload} /> : null}
            </section>
            <section className="grid gap-3 border-t border-border pt-4" aria-label="Application follow-ups">
              <h3 className="text-base font-medium">Follow-ups & tasks</h3>
              {detail.tasks.length ? (
                <ul className="grid gap-2 text-sm">
                  {detail.tasks.map((task) => (
                    <li key={task.id} className="rounded-md bg-muted/30 p-3">
                      <span className="capitalize">{task.kind.replace(/_/g, " ")}</span> ·{" "}
                      {task.due_date ? fmtDateOnly(task.due_date) : fmtInstant(task.due_at, detail.timezone)} · {task.state}
                      {task.note ? <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{task.note}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
              )}
              {!detail.app.trashed_at ? (
                <FollowUpShortcuts applicationId={detail.app.id} today={localDateIn(new Date(), detail.timezone)} onSaved={reload} />
              ) : null}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
