"use client";
import { useActionState } from "react";
import { DateTime } from "luxon";
import { addTaskAction } from "@/app/(app)/applications/actions";
import { FormAlert, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
export function FollowUpShortcuts({ applicationId, today, onSaved }: { applicationId: string; today: string; onSaved?: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(async (previous, fd) => {
    const days = fd.get("days");
    if (days === "7" || days === "14")
      fd.set(
        "due_date",
        DateTime.fromISO(today, { zone: "utc" })
          .plus({ days: Number(days) })
          .toISODate()!,
      );
    const result = await addTaskAction(previous, fd);
    if (result.status === "ok") onSaved?.();
    return result;
  }, {});
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">Set a follow-up reminder</h3>
      <FormAlert state={state} />
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="kind" value="follow_up" />
      <input type="hidden" name="due_kind" value="date" />
      <input type="hidden" name="source" value="user" />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="days" value="7" size="sm" variant="outline" disabled={state.status === "ok"}>
          In 7 days
        </SubmitButton>
        <SubmitButton name="days" value="14" size="sm" variant="outline" disabled={state.status === "ok"}>
          In 14 days
        </SubmitButton>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Custom follow-up date"
          name="due_date"
          type="date"
          defaultValue={DateTime.fromISO(today, { zone: "utc" }).plus({ days: 7 }).toISODate()!}
        />
        <SubmitButton name="days" value="custom" size="sm" disabled={state.status === "ok"}>
          Set reminder
        </SubmitButton>
      </div>
    </form>
  );
}
