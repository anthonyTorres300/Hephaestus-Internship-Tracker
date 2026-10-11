"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert, SelectField, SubmitButton, TextField, type FormState } from "@/components/forms/fields";
import { addVerificationAction, setAccountStateAction } from "./actions";

export function RefreshButton() {
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await fetch("/api/discovery/refresh", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 202)
        setState({
          status: "ok",
          message: `Refresh requested (correlation ${body.correlation_id}). It runs on GitHub Actions; check the Runs tab.`,
        });
      else setState({ status: "error", message: body?.error?.message ?? "Could not start a refresh." });
    } catch {
      setState({ status: "error", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      <FormAlert state={state} />
      <div>
        <Button onClick={go} disabled={busy}>
          {busy ? "Requesting…" : "Refresh catalog now"}
        </Button>
      </div>
    </div>
  );
}

export function VerificationForm() {
  const [state, action] = useActionState<FormState, FormData>(addVerificationAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Job id" name="job_id" required pattern="[0-9a-fA-F-]{36}" />
        <SelectField
          label="Finding"
          name="state"
          defaultValue="open"
          options={[
            { value: "open", label: "Employer page shows open" },
            { value: "closed", label: "Employer page shows closed" },
          ]}
        />
        <TextField label="Public evidence link (https)" name="url" type="url" required />
        <TextField label="Note" name="note" maxLength={1000} />
      </div>
      <div>
        <SubmitButton size="sm">Record public evidence</SubmitButton>
      </div>
    </form>
  );
}

export function AccountStateForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setAccountStateAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="state" value={suspended ? "active" : "suspended"} />
      {!suspended ? (
        <input
          name="reason"
          aria-label="Reason code"
          placeholder="reason code"
          maxLength={64}
          className="h-7 w-32 rounded border bg-background px-2 text-xs"
        />
      ) : null}
      <SubmitButton size="xs" variant={suspended ? "outline" : "destructive"} pendingText="…">
        {suspended ? "Reactivate" : "Suspend"}
      </SubmitButton>
      {state.message ? (
        <span role="status" className="text-xs">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
