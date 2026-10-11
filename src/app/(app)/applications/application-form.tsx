"use client";

import { useActionState, useState } from "react";
import {
  CheckboxField,
  FormAlert,
  NativeSelect,
  SelectField,
  SubmitButton,
  TextField,
  Field,
  type FormState,
} from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL, isSubmittedStatus, type Status } from "@/lib/domain";
import { createApplicationAction, updateApplicationAction } from "./actions";

export interface FormInitial {
  id?: string;
  revision?: number;
  company_name?: string;
  role_title?: string;
  status?: Status;
  priority?: string;
  application_url?: string | null;
  portal_url?: string | null;
  requisition_id?: string | null;
  work_mode?: string | null;
  role_category?: string | null;
  season?: string | null;
  season_year?: number | null;
  locations?: string[];
  contact_channel?: string | null;
  job_id?: string | null;
  submitted_precision?: string;
  submitted_year?: number | null;
  submitted_month?: number | null;
  submitted_day?: number | null;
  submission_date_unknown?: boolean;
}

const pad = (n: number | null | undefined) => String(n ?? 0).padStart(2, "0");

export function SubmissionFields({ state, initial }: { state?: FormState; initial?: FormInitial }) {
  const startKnown = initial?.submission_date_unknown ? "unknown" : initial?.submitted_precision === "month" ? "month" : "day";
  const [known, setKnown] = useState<string>(state?.values?.date_known ?? startKnown);
  const dayDefault =
    initial?.submitted_precision === "day" ? `${initial.submitted_year}-${pad(initial.submitted_month)}-${pad(initial.submitted_day)}` : "";
  const monthDefault = initial?.submitted_precision === "month" ? `${initial.submitted_year}-${pad(initial.submitted_month)}` : "";
  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Submission date</legend>
      <Field label="Date is known as" name="date_known">
        <NativeSelect id="f-date_known" name="date_known" value={known} onChange={(e) => setKnown(e.target.value)}>
          <option value="day">An exact day</option>
          <option value="month">Month only</option>
          <option value="unknown">Unknown</option>
        </NativeSelect>
      </Field>
      {known === "day" ? <TextField label="Submitted on" name="submitted_day" type="date" state={state} defaultValue={dayDefault} /> : null}
      {known === "month" ? (
        <TextField label="Submitted in" name="submitted_month" type="month" state={state} defaultValue={monthDefault} />
      ) : null}
      {known === "unknown" ? (
        <p className="text-xs text-muted-foreground">Recorded as “submission date unknown”. It is never guessed.</p>
      ) : null}
    </fieldset>
  );
}

export function ApplicationForm({ mode, initial, idem }: { mode: "create" | "edit"; initial?: FormInitial; idem?: string }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createApplicationAction : updateApplicationAction, {});
  const [status, setStatus] = useState<Status>((state.values?.status as Status) ?? initial?.status ?? "prepared");
  const submitted = isSubmittedStatus(status);
  const v = (k: keyof FormInitial) => (state.values?.[k] ?? (initial?.[k] as string | number | null | undefined) ?? "") as string;

  return (
    <form action={action} className="grid gap-5">
      <FormAlert state={state} />
      {mode === "create" ? (
        <input type="hidden" name="idem" value={idem} />
      ) : (
        <>
          <input type="hidden" name="id" value={initial?.id} />
          <input type="hidden" name="revision" value={initial?.revision} />
        </>
      )}
      {initial?.job_id ? <input type="hidden" name="job_id" value={initial.job_id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Company" name="company_name" required state={state} defaultValue={v("company_name")} maxLength={200} />
        <TextField label="Role title" name="role_title" required state={state} defaultValue={v("role_title")} maxLength={300} />
        {mode === "create" ? (
          <Field label="Status" name="status" hint="Saving a job is not the same as submitting.">
            <NativeSelect id="f-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </div>

      {mode === "create" && submitted ? (
        <>
          <SubmissionFields state={state} initial={initial} />
          <CheckboxField
            name="attested"
            required
            label="I confirm I submitted this application."
            hint="Required for any status beyond Saved or Prepared."
          />
        </>
      ) : null}
      {mode === "edit" && initial?.status && isSubmittedStatus(initial.status) ? (
        <SubmissionFields state={state} initial={initial} />
      ) : null}

      {mode === "create" ? (
        <details className="rounded-md bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-medium">More details (priority, links, location, season)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Priority"
              name="priority"
              state={state}
              defaultValue={v("priority") || "medium"}
              options={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <TextField
              label="Application link"
              name="application_url"
              type="url"
              state={state}
              defaultValue={v("application_url")}
              placeholder="https://…"
              hint="Where you apply. Opening it never changes status."
            />
            <TextField
              label="Progress portal link"
              name="portal_url"
              type="url"
              state={state}
              defaultValue={v("portal_url")}
              placeholder="https://…"
              hint="Candidate portal for checking progress (kept separate)."
            />
            <TextField label="Requisition ID" name="requisition_id" state={state} defaultValue={v("requisition_id")} />
            <TextField
              label="Locations"
              name="locations"
              state={state}
              defaultValue={initial?.locations?.join(", ") ?? v("locations")}
              hint="Comma separated."
            />
            <SelectField
              label="Work mode"
              name="work_mode"
              state={state}
              placeholder="Unknown"
              defaultValue={v("work_mode")}
              options={[
                { value: "onsite", label: "On-site" },
                { value: "hybrid", label: "Hybrid" },
                { value: "remote", label: "Remote" },
              ]}
            />
            <TextField
              label="Role category"
              name="role_category"
              state={state}
              defaultValue={v("role_category")}
              placeholder="e.g. backend, data, ai_ml"
            />
            <SelectField
              label="Target season"
              name="season"
              state={state}
              placeholder="Unknown"
              defaultValue={v("season")}
              options={[
                { value: "summer", label: "Summer" },
                { value: "fall", label: "Fall" },
                { value: "winter", label: "Winter" },
                { value: "spring", label: "Spring" },
              ]}
            />
            <TextField
              label="Target year"
              name="season_year"
              type="number"
              min={2000}
              max={2100}
              state={state}
              defaultValue={v("season_year")}
            />
            <TextField
              label="Contact / channel"
              name="contact_channel"
              state={state}
              defaultValue={v("contact_channel")}
              hint="Recruiter, email or portal notes."
            />
          </div>
        </details>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Priority"
            name="priority"
            state={state}
            defaultValue={v("priority") || "medium"}
            options={[
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <TextField
            label="Application link"
            name="application_url"
            type="url"
            state={state}
            defaultValue={v("application_url")}
            placeholder="https://…"
            hint="Where you apply. Opening it never changes status."
          />
          <TextField
            label="Progress portal link"
            name="portal_url"
            type="url"
            state={state}
            defaultValue={v("portal_url")}
            placeholder="https://…"
            hint="Candidate portal for checking progress (kept separate)."
          />
          <TextField label="Requisition ID" name="requisition_id" state={state} defaultValue={v("requisition_id")} />
          <TextField
            label="Locations"
            name="locations"
            state={state}
            defaultValue={initial?.locations?.join(", ") ?? v("locations")}
            hint="Comma separated."
          />
          <SelectField
            label="Work mode"
            name="work_mode"
            state={state}
            placeholder="Unknown"
            defaultValue={v("work_mode")}
            options={[
              { value: "onsite", label: "On-site" },
              { value: "hybrid", label: "Hybrid" },
              { value: "remote", label: "Remote" },
            ]}
          />
          <TextField
            label="Role category"
            name="role_category"
            state={state}
            defaultValue={v("role_category")}
            placeholder="e.g. backend, data, ai_ml"
          />
          <SelectField
            label="Target season"
            name="season"
            state={state}
            placeholder="Unknown"
            defaultValue={v("season")}
            options={[
              { value: "summer", label: "Summer" },
              { value: "fall", label: "Fall" },
              { value: "winter", label: "Winter" },
              { value: "spring", label: "Spring" },
            ]}
          />
          <TextField
            label="Target year"
            name="season_year"
            type="number"
            min={2000}
            max={2100}
            state={state}
            defaultValue={v("season_year")}
          />
          <TextField
            label="Contact / channel"
            name="contact_channel"
            state={state}
            defaultValue={v("contact_channel")}
            hint="Recruiter, email or portal notes."
          />
        </div>
      )}

      <div>
        <SubmitButton pendingText="Saving…">{mode === "create" ? "Create application" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
