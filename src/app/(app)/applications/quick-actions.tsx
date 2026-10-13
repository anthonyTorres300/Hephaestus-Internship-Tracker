"use client";

import { MessageSquare, CalendarPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NativeSelect, FormAlert, TextField, SubmitButton, type FormState } from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL, canMoveTo, isSubmittedStatus, type Status } from "@/lib/domain/status";
import { moveStatusAction, addNoteAction, addTaskAction } from "./actions";

export function QuickActions({
  id,
  revision,
  status,
  company,
  portal,
  today,
}: {
  id: string;
  revision: number;
  status: Status;
  company: string;
  portal?: string | null;
  today: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"status" | "note" | "followup" | null>(null);
  const [to, setTo] = useState<Status>(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [noteState, noteAction] = useActionState<FormState, FormData>(addNoteAction, {});
  const [taskState, taskAction] = useActionState<FormState, FormData>(addTaskAction, {});
  const needsDate = !isSubmittedStatus(status) && isSubmittedStatus(to);
  const needsReason = canMoveTo(status, to).reason === "reason_required";
  return (
    <div className="relative z-10 flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10 px-1"
        onClick={() => {
          setMode("status");
          setTo(status);
          setMessage("");
        }}
        aria-label={`Change status for ${company}`}
      >
        <StatusBadge status={status} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10"
        onClick={() => setMode("note")}
        aria-label={`Add note for ${company}`}
        title="Add note"
      >
        <MessageSquare aria-hidden className="size-4" />
        <span className="md:sr-only">Note</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10"
        onClick={() => setMode("followup")}
        aria-label={`Create follow-up for ${company}`}
        title="Create follow-up"
      >
        <CalendarPlus aria-hidden className="size-4" />
        <span className="md:sr-only">Follow-up</span>
      </Button>
      {portal ? (
        <a className="inline-flex min-h-10 items-center px-2 text-xs underline" href={portal} target="_blank" rel="noopener noreferrer">
          Portal<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && !busy && setMode(null)}>
        {mode !== null ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{mode === "status" ? "Update status" : mode === "note" ? "Add a note" : "Create follow-up"}</DialogTitle>
              <DialogDescription>{company}</DialogDescription>
            </DialogHeader>
            {mode === "status" ? (
              <form
                className="grid gap-3"
                action={async (fd) => {
                  setBusy(true);
                  setMessage("");
                  try {
                    const result = await moveStatusAction({
                      id,
                      revision,
                      status: to,
                      idem: crypto.randomUUID(),
                      reason: String(fd.get("reason") ?? ""),
                      ...(needsDate ? { attested: true, date_known: "day", submitted_day: String(fd.get("submitted_day")) } : {}),
                    });
                    if (!result.ok) setMessage(result.message);
                    else {
                      setMode(null);
                      router.refresh();
                    }
                  } catch {
                    setMessage("Could not save. Check your connection and try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="grid gap-1 text-sm">
                  Status
                  <NativeSelect value={to} onChange={(e) => setTo(e.target.value as Status)}>
                    {STATUSES.filter((s) => !isSubmittedStatus(status) || isSubmittedStatus(s)).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {needsDate ? <TextField name="submitted_day" label="Applied on" type="date" required defaultValue={today} /> : null}
                {needsReason ? <TextField name="reason" label="Reason for reopening" required maxLength={500} /> : null}
                {message ? (
                  <p role="alert" className="text-sm text-destructive">
                    {message}
                  </p>
                ) : null}
                <Button type="submit" disabled={busy || to === status}>
                  {busy ? "Saving…" : "Save status"}
                </Button>
              </form>
            ) : mode === "note" ? (
              <form action={noteAction} className="grid gap-3">
                <FormAlert state={noteState} />
                <input type="hidden" name="application_id" value={id} />
                <label className="grid gap-1 text-sm">
                  Note
                  <textarea name="body" required maxLength={10000} className="min-h-28 rounded-md border bg-background p-3 text-base" />
                </label>
                <SubmitButton>Add note</SubmitButton>
              </form>
            ) : (
              <form action={taskAction} className="grid gap-3">
                <FormAlert state={taskState} />
                <input type="hidden" name="application_id" value={id} />
                <input type="hidden" name="kind" value="follow_up" />
                <input type="hidden" name="due_kind" value="date" />
                <input type="hidden" name="source" value="user" />
                <TextField label="Due date" name="due_date" type="date" required defaultValue={today} />
                <TextField label="Note (optional)" name="note" maxLength={2000} />
                <SubmitButton>Create follow-up</SubmitButton>
              </form>
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
