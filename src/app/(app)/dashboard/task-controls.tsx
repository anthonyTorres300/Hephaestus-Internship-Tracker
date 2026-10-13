"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormAlert, NativeSelect, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { addTaskAction, taskTransitionAction } from "../applications/actions";

export function TaskControls({ id, applicationId }: { id: string; applicationId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(op: string) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("id", id);
    fd.set("op", op);
    if (applicationId) fd.set("application_id", applicationId);
    try {
      await taskTransitionAction(fd);
      router.refresh();
    } catch {
      setError("Could not update this task. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="w-full">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("complete")}>
          Complete
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run("snooze")}>
          Snooze 1 day
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CreateFollowUp({ apps, today }: { apps: { id: string; label: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(addTaskAction, {});
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Create follow-up
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create follow-up</DialogTitle>
            <DialogDescription>Set a reminder for an application or a general task.</DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <FormAlert state={state} />
            <label className="grid gap-1 text-sm">
              Application
              <NativeSelect name="application_id">
                <option value="">General reminder</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <input type="hidden" name="kind" value="follow_up" />
            <input type="hidden" name="due_kind" value="date" />
            <input type="hidden" name="source" value="user" />
            <TextField name="due_date" label="Due date" type="date" defaultValue={today} required />
            <TextField name="note" label="Note (optional)" maxLength={2000} />
            <SubmitButton>Create follow-up</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
