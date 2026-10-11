"use client";

import { useActionState } from "react";
import { Field, FormAlert, SelectField, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { Textarea } from "@/components/ui/textarea";
import { verifyEmployerAction } from "../actions";

export function VerifyForm({ jobId, current }: { jobId: string; current: { state: string; url: string | null; note: string | null } }) {
  const [state, action] = useActionState<FormState, FormData>(verifyEmployerAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="job_id" value={jobId} />
      <SelectField
        label="What you found on the employer's page"
        name="state"
        defaultValue={current.state}
        state={state}
        options={[
          { value: "none", label: "Not checked" },
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
      />
      <TextField
        label="Employer page you checked"
        name="url"
        type="url"
        defaultValue={current.url ?? ""}
        state={state}
        placeholder="https://…"
        hint="https only."
      />
      <Field label="Evidence note" name="note" state={state}>
        <Textarea id="f-note" name="note" rows={2} maxLength={1000} defaultValue={current.note ?? ""} />
      </Field>
      <div>
        <SubmitButton size="sm">Save my check</SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">
        Private to you. It is timestamped and treated as stale after 7 days. It never changes the shared listing.
      </p>
    </form>
  );
}
