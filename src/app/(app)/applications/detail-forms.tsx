"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CheckboxField,
  Field,
  FormAlert,
  NativeSelect,
  SelectField,
  SubmitButton,
  TextField,
  type FormState,
} from "@/components/forms/fields";
import { Textarea } from "@/components/ui/textarea";
import { STATUSES, STATUS_LABEL, canMoveTo, isSubmittedStatus, type Status } from "@/lib/domain";
import { addInterviewAction, addNoteAction, addTaskAction, changeStatusAction, editNoteAction } from "./actions";
import { SubmissionFields } from "./application-form";

export function StatusForm({
  id,
  revision,
  current,
  idem,
  onSaved,
}: {
  id: string;
  revision: number;
  current: Status;
  idem: string;
  onSaved?: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(changeStatusAction, {});
  useEffect(() => {
    if (state.status === "ok") onSaved?.();
  }, [state, onSaved]);
  const [next, setNext] = useState<Status>(current);
  const move = canMoveTo(current, next);
  const needsSubmission = !isSubmittedStatus(current) && isSubmittedStatus(next);
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="idem" value={idem} />
      <Field label="New status" name="status">
        <NativeSelect id="f-status" name="status" value={next} onChange={(e) => setNext(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {needsSubmission ? (
        <>
          <SubmissionFields state={state} />
          <CheckboxField name="attested" required label="I confirm I submitted this application." />
        </>
      ) : null}
      <TextField
        label="Reason"
        name="reason"
        state={state}
        required={move.reason === "reason_required"}
        hint={move.reason === "reason_required" ? "Required when reopening." : "Optional: why is the status changing?"}
      />
      <TextField label="Effective at (optional)" name="effective_at" type="datetime-local" state={state} hint="Leave blank to use now." />
      {!move.ok ? (
        <p role="alert" className="text-xs text-destructive">
          A submitted application cannot go back to {STATUS_LABEL[next]}.
        </p>
      ) : null}
      <SubmitButton disabled={next === current || !move.ok}>Update status</SubmitButton>
    </form>
  );
}

export function NoteForm({ applicationId, onSaved }: { applicationId: string; onSaved?: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(addNoteAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") {
      ref.current?.reset();
      onSaved?.();
    }
  }, [state, onSaved]);
  return (
    <form ref={ref} action={action} className="grid gap-2">
      <FormAlert state={state} />
      <input type="hidden" name="application_id" value={applicationId} />
      <Field label="Add a note" name="body" state={state}>
        <Textarea
          id="f-body"
          name="body"
          rows={3}
          maxLength={10000}
          required
          placeholder="Plain text or simple Markdown. HTML is not rendered."
        />
      </Field>
      <div>
        <SubmitButton size="sm">Add note</SubmitButton>
      </div>
    </form>
  );
}

export function NoteEditForm({ id, applicationId, body }: { id: string; applicationId: string; body: string }) {
  const [state, action] = useActionState<FormState, FormData>(editNoteAction, {});
  return (
    <form action={action} className="grid gap-2">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="application_id" value={applicationId} />
      <Field label="Edit note" name="body" state={state}>
        <Textarea id="f-body" name="body" rows={3} defaultValue={body} required maxLength={10000} />
      </Field>
      <div>
        <SubmitButton size="sm" variant="outline">
          Save note
        </SubmitButton>
      </div>
    </form>
  );
}

export function InterviewForm({ applicationId, timezone }: { applicationId: string; timezone: string }) {
  const [state, action] = useActionState<FormState, FormData>(addInterviewAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="timezone" value={timezone} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Round" name="round_number" type="number" min={1} max={20} defaultValue="1" state={state} />
        <SelectField
          label="Type"
          name="round_type"
          placeholder="Unspecified"
          state={state}
          options={["recruiter", "technical", "behavioral", "onsite", "final", "other"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          }))}
        />
        <TextField
          label={`Date and time (${timezone})`}
          name="scheduled_local"
          type="datetime-local"
          state={state}
          hint="Leave blank if not scheduled yet."
        />
        <SelectField
          label="Outcome"
          name="outcome"
          defaultValue="pending"
          state={state}
          options={["pending", "passed", "failed", "cancelled", "unknown"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          }))}
        />
      </div>
      <Field label="Notes" name="notes" state={state}>
        <Textarea id="f-notes" name="notes" rows={2} maxLength={5000} />
      </Field>
      <div>
        <SubmitButton size="sm">Add round</SubmitButton>
      </div>
    </form>
  );
}

export function TaskForm({ applicationId, timezone }: { applicationId?: string; timezone: string }) {
  const [state, action] = useActionState<FormState, FormData>(addTaskAction, {});
  const [kind, setKind] = useState("date");
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="follow_up"
          state={state}
          options={[
            { value: "follow_up", label: "Follow-up" },
            { value: "application_deadline", label: "Application deadline" },
            { value: "offer_deadline", label: "Offer deadline" },
            { value: "review", label: "Review" },
          ]}
        />
        <Field label="Due as" name="due_kind">
          <NativeSelect id="f-due_kind" name="due_kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="date">A date (no time)</option>
            <option value="time">A specific time</option>
          </NativeSelect>
        </Field>
        {kind === "date" ? (
          <TextField label="Due date" name="due_date" type="date" state={state} required />
        ) : (
          <TextField label={`Due (${timezone})`} name="due_local" type="datetime-local" state={state} required />
        )}
        <SelectField
          label="Source"
          name="source"
          defaultValue="user"
          state={state}
          options={[
            { value: "user", label: "I set this" },
            { value: "source_claim", label: "Stated by the employer/listing" },
          ]}
        />
      </div>
      <TextField label="Note" name="note" state={state} maxLength={2000} />
      <div>
        <SubmitButton size="sm">Add task</SubmitButton>
      </div>
    </form>
  );
}
