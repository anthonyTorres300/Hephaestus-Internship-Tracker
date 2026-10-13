"use client";

import { useActionState, useState } from "react";
import { FormAlert, NativeSelect, SelectField, SubmitButton, TextField, Field, type FormState } from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL, isSubmittedStatus, type Status } from "@/lib/domain";
import { seasonKey } from "@/lib/data/seasons";
import { seasonLabel } from "@/lib/ui/format";
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

export interface SeasonOption {
  key: string;
  label: string;
}

const NEW_SEASON = "__new";

// Pick one of the user's seasons, leave it unclassified, or type a new one. Posts `season` + `season_year` either way.
function SeasonPicker({
  seasons,
  initial,
  state,
  defaultYear,
}: {
  seasons: SeasonOption[];
  initial?: FormInitial;
  state: FormState;
  defaultYear: number;
}) {
  const initialKey = initial?.season && initial?.season_year ? seasonKey(initial.season, initial.season_year) : "";
  const options =
    initialKey && !seasons.some((s) => s.key === initialKey)
      ? [...seasons, { key: initialKey, label: seasonLabel(initial?.season, initial?.season_year) }]
      : seasons;
  const [pick, setPick] = useState(initialKey);
  const i = pick.lastIndexOf(":");
  const known = pick && pick !== NEW_SEASON;
  return (
    <>
      <Field
        label="Season"
        name="season_pick"
        hint={pick === NEW_SEASON ? undefined : "Create seasons from the tabs on the Applications page, or choose New season."}
      >
        <NativeSelect id="f-season_pick" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Unclassified</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
          <option value={NEW_SEASON}>+ New season…</option>
        </NativeSelect>
      </Field>
      {pick === NEW_SEASON ? (
        <>
          <TextField
            label="Season name"
            name="season"
            state={state}
            maxLength={30}
            placeholder="e.g. Summer, Co-op"
            defaultValue={state.values?.season ?? ""}
          />
          <TextField
            label="Season year"
            name="season_year"
            type="number"
            min={2000}
            max={2100}
            state={state}
            defaultValue={state.values?.season_year ?? String(defaultYear)}
          />
        </>
      ) : (
        <>
          <input type="hidden" name="season" value={known ? pick.slice(0, i) : ""} />
          <input type="hidden" name="season_year" value={known ? pick.slice(i + 1) : ""} />
        </>
      )}
    </>
  );
}

export function ApplicationForm({
  mode,
  initial,
  idem,
  seasons = [],
  defaultYear = new Date().getFullYear() + 1,
}: {
  mode: "create" | "edit";
  initial?: FormInitial;
  idem?: string;
  seasons?: SeasonOption[];
  defaultYear?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createApplicationAction : updateApplicationAction, {});
  const [status, setStatus] = useState<Status>((state.values?.status as Status) ?? initial?.status ?? "applied");
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
          <Field label="Status" name="status" hint="New entries default to Applied.">
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
          <input type="hidden" name="attested" value="on" />
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
            <SeasonPicker seasons={seasons} initial={initial} state={state} defaultYear={defaultYear} />
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
          <SeasonPicker seasons={seasons} initial={initial} state={state} defaultYear={defaultYear} />
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
        <SubmitButton pendingText="Saving…">{mode === "create" ? "Add application" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
