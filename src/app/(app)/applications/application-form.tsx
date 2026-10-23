"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert, NativeSelect, SelectField, SubmitButton, TextField, Field, type FormState } from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL, isSubmittedStatus, type Status } from "@/lib/domain";
import { seasonKey } from "@/lib/data/seasons";
import { seasonLabel } from "@/lib/ui/format";
import { saveApplicationAction, updateApplicationAction } from "./actions";

import { Button } from "@/components/ui/button";
import { JobLinkPrefill } from "@/components/applications/job-link-prefill";
import { DuplicateWarning } from "@/components/applications/duplicate-warning";
import { FollowUpShortcuts } from "@/components/applications/follow-up-shortcuts";
import { applicationOperationKey } from "@/lib/applications/operation-key";
import { draftFields, restoreInitial, continuingInitial, readApplicationDraft } from "@/lib/applications/drafts";
import type { ApplicationSaveState, JobSuggestion } from "@/lib/applications/types";
import { localDateIn } from "@/lib/domain/dates";

export interface FormInitial {
  draftValues?: Record<string, string>;
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
  const [pick, setPick] = useState(initial?.draftValues?.season_pick ?? initialKey);
  const i = pick.lastIndexOf(":");
  const known = pick && pick !== NEW_SEASON;
  return (
    <>
      <Field
        label="Season"
        name="season_pick"
        hint={pick === NEW_SEASON ? undefined : "Create seasons from the tabs on the Applications page, or choose New season."}
      >
        <NativeSelect id="f-season_pick" name="season_pick" value={pick} onChange={(e) => setPick(e.target.value)}>
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
            defaultValue={state.values?.season ?? initial?.draftValues?.season ?? ""}
          />
          <TextField
            label="Season year"
            name="season_year"
            type="number"
            min={2000}
            max={2100}
            state={state}
            defaultValue={state.values?.season_year ?? initial?.draftValues?.season_year ?? String(defaultYear)}
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

function ApplicationFormFields({
  mode,
  initial,
  idem,
  seasons = [],
  defaultYear = new Date().getFullYear() + 1,
  compact,
  onCreated,
  onSuggestion,
  saveAction,
  draftMessage,
  onDiscard,
}: {
  mode: "create" | "edit";
  initial?: FormInitial;
  idem?: string;
  seasons?: SeasonOption[];
  defaultYear?: number;
  compact?: boolean;
  draftMessage?: string;
  onDiscard?: () => void;
  onCreated?: (state: ApplicationSaveState, fd: FormData) => void;
  onSuggestion?: (suggestion: JobSuggestion, fd: FormData) => void;
  saveAction?: (state: ApplicationSaveState, fd: FormData) => Promise<ApplicationSaveState>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ApplicationSaveState, FormData>(async (previous, fd) => {
    if (mode === "create") fd.set("idem", await applicationOperationKey(fd));
    const result: ApplicationSaveState =
      mode === "create" ? await (saveAction ?? saveApplicationAction)(previous, fd) : await updateApplicationAction(previous, fd);
    if (result.applicationId) onCreated?.(result, fd);
    return result;
  }, {});
  const [candidate, setCandidate] = useState({
    company_name: initial?.company_name ?? "",
    application_url: initial?.application_url ?? "",
    requisition_id: initial?.requisition_id ?? "",
    job_id: initial?.job_id ?? undefined,
  });
  const [status, setStatus] = useState<Status>((state.values?.status as Status) ?? initial?.status ?? "applied");
  const submitted = isSubmittedStatus(status);
  const v = (k: keyof FormInitial) =>
    (state.values?.[k] ?? initial?.draftValues?.[k] ?? (initial?.[k] as string | number | null | undefined) ?? "") as string;

  return (
    <form
      ref={ref}
      data-application-form
      aria-busy={pending}
      action={action}
      className="grid gap-5"
      onChange={() => {
        if (!ref.current) return;
        const fd = new FormData(ref.current);
        setCandidate({
          company_name: String(fd.get("company_name") ?? ""),
          application_url: String(fd.get("application_url") ?? ""),
          requisition_id: String(fd.get("requisition_id") ?? ""),
          job_id: initial?.job_id ?? undefined,
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {draftMessage ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span role="status">{draftMessage}</span>
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
              Discard draft
            </Button>
          </div>
        ) : null}
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
          <TextField
            label="Company"
            name="company_name"
            autoFocus={compact}
            required
            state={state}
            defaultValue={v("company_name")}
            maxLength={200}
          />
          <TextField label="Role title" name="role_title" required state={state} defaultValue={v("role_title")} maxLength={300} />
          {mode === "create" && !compact ? (
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

        {mode === "create" ? (
          <div className="grid gap-2">
            <TextField
              label="Job posting link"
              name="application_url"
              type="url"
              state={state}
              defaultValue={v("application_url")}
              placeholder="https://…"
              maxLength={500}
            />
            <JobLinkPrefill
              url={candidate.application_url}
              onAccept={(suggestion) => {
                if (ref.current) onSuggestion?.(suggestion, new FormData(ref.current));
              }}
            />
          </div>
        ) : null}

        {mode === "create" && compact ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" name="status">
              <NativeSelect id="f-status" name="status" value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {submitted ? (
              <div>
                {initial?.submitted_precision === "month" || initial?.submission_date_unknown ? (
                  <SubmissionFields state={state} initial={initial} />
                ) : (
                  <>
                    <input type="hidden" name="date_known" value="day" />
                    <TextField
                      label="Submitted on"
                      name="submitted_day"
                      type="date"
                      state={state}
                      required
                      defaultValue={
                        initial?.submitted_year
                          ? `${initial.submitted_year}-${pad(initial.submitted_month)}-${pad(initial.submitted_day)}`
                          : ""
                      }
                    />
                  </>
                )}
                <input type="hidden" name="attested" value="on" />
              </div>
            ) : (
              <p className="self-center text-xs text-muted-foreground">This status does not record a submitted application.</p>
            )}
          </div>
        ) : null}

        {mode === "create" && submitted && !compact ? (
          <>
            <SubmissionFields state={state} initial={initial} />
            <input type="hidden" name="attested" value="on" />
          </>
        ) : null}
        {mode === "edit" && initial?.status && isSubmittedStatus(initial.status) ? (
          <SubmissionFields state={state} initial={initial} />
        ) : null}

        {mode === "create" ? (
          <details open={!compact && !!initial?.draftValues} className="rounded-md bg-muted/60 p-4">
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

        {mode === "create" ? (
          <DuplicateWarning
            key={JSON.stringify(candidate)}
            candidate={candidate}
            serverMatches={
              state.values?.company_name === candidate.company_name &&
              (state.values?.application_url ?? "") === candidate.application_url &&
              (state.values?.requisition_id ?? "") === candidate.requisition_id
                ? state.duplicates
                : undefined
            }
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="intent" value="save" pendingText="Saving…">
            {mode === "create" ? "Save application" : "Save changes"}
          </SubmitButton>
          {mode === "create" ? (
            <SubmitButton name="intent" value="another" variant="outline" pendingText="Saving…">
              Save & log another
            </SubmitButton>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

type ApplicationFormProps = {
  mode: "create" | "edit";
  initial?: FormInitial;
  idem?: string;
  seasons?: SeasonOption[];
  defaultYear?: number;
  draftScope?: string;
  compact?: boolean;
  timezone?: string;
  onSaved?: (id: string, fields?: FormInitial) => void;
  saveAction?: (state: ApplicationSaveState, fd: FormData) => Promise<ApplicationSaveState>;
};
export function ApplicationForm(props: ApplicationFormProps) {
  const router = useRouter();
  const [ready, setReady] = useState(props.mode === "edit");
  const [initial, setInitial] = useState(props.initial);
  const [idem, setIdem] = useState(props.idem ?? "");
  const [epoch, setEpoch] = useState(0);
  const [draftMessage, setDraftMessage] = useState("");
  const [saved, setSaved] = useState<{ id: string; company: string; continuing: boolean; next: FormInitial } | null>(null);
  const initialProps = useRef(props);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const entryDefaults = useRef(props.initial);
  const [draftKey, setDraftKey] = useState(
    props.draftScope ? `application-draft:v1:${props.draftScope}:${props.initial?.job_id ?? "manual"}` : null,
  );
  useEffect(() => {
    const start = initialProps.current;
    if (start.mode !== "create") return;
    try {
      const cached = draftKey ? readApplicationDraft(localStorage, draftKey) : null;
      if (cached) {
        setInitial(restoreInitial(cached.fields, entryDefaults.current));
        setIdem(cached.idem);
        setDraftMessage("Draft restored from this browser.");
      } else setIdem(start.idem ?? crypto.randomUUID());
    } catch {
      setIdem(start.idem ?? crypto.randomUUID());
      setDraftMessage("Draft saving is unavailable in this browser.");
    }
    setReady(true);
  }, [draftKey]);
  function remember(fd: FormData, operation = idem) {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ version: 1, savedAt: Date.now(), idem: operation, fields: draftFields(fd) }));
      setDraftMessage("Draft saved on this browser.");
    } catch {
      setDraftMessage("Draft saving is unavailable in this browser.");
    }
  }
  function clearDraft(submitted?: FormData) {
    if (draftKey)
      try {
        if (submitted) {
          const current = readApplicationDraft(localStorage, draftKey);
          const ordered = (fields: Record<string, string>) =>
            JSON.stringify(Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
          if (current && (current.idem !== idem || ordered(current.fields) !== ordered(draftFields(submitted)))) return;
        }
        localStorage.removeItem(draftKey);
      } catch {}
  }
  function prepareNext(next: FormInitial | undefined, clearExisting = true) {
    if (clearExisting) clearDraft();
    entryDefaults.current = next;
    const operation = crypto.randomUUID();
    const target = props.draftScope ? `application-draft:v1:${props.draftScope}:${next?.job_id ?? "manual"}` : null;
    // A second application from a job card becomes a manual draft, without inheriting that listing's identity.
    if (target && target !== draftKey) {
      const fields = {
        ...next?.draftValues,
        company_name: next?.company_name ?? "",
        role_title: next?.role_title ?? "",
        application_url: next?.application_url ?? "",
        portal_url: "",
        requisition_id: "",
        locations: "",
        work_mode: "",
        role_category: "",
        contact_channel: "",
        status: next?.status ?? "applied",
      };
      if (next?.job_id) Object.assign(fields, { job_id: next.job_id });
      try {
        localStorage.setItem(target, JSON.stringify({ version: 1, savedAt: Date.now(), idem: operation, fields }));
      } catch {}
    }
    setDraftKey(target);
    setInitial(next);
    setIdem(operation);
    setEpoch((value) => value + 1);
    setDraftMessage("");
  }
  function restart(next = entryDefaults.current) {
    prepareNext(next);
    setSaved(null);
  }
  function created(state: ApplicationSaveState, fd: FormData) {
    clearDraft(fd);
    props.onSaved?.(state.applicationId!, restoreInitial(draftFields(fd)));
    router.refresh();
    if (!mounted.current) return;
    setDraftMessage("");
    const continuing = fd.get("intent") === "another";
    setSaved({ id: state.applicationId!, company: String(fd.get("company_name")), continuing, next: continuingInitial(fd) });
    if (continuing) prepareNext(continuingInitial(fd), false);
  }
  function accept(suggestion: JobSuggestion, fd: FormData) {
    const fields = draftFields(fd);
    for (const [key, value] of Object.entries(suggestion)) if (value != null) fields[key] = Array.isArray(value) ? value.join(", ") : value;
    setInitial(restoreInitial(fields, initial));
    setEpoch((value) => value + 1);
    const draft = new FormData();
    for (const [key, value] of Object.entries(fields)) draft.set(key, value);
    remember(draft);
  }
  if (!ready)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading application form…
      </p>
    );
  return (
    <div
      className="grid gap-4"
      onChange={(event) => {
        if (props.mode !== "create") return;
        const form = (event.target as HTMLElement).closest<HTMLFormElement>("form[data-application-form]");
        if (form)
          queueMicrotask(() => {
            if (form.isConnected && form.getAttribute("aria-busy") !== "true") remember(new FormData(form));
          });
      }}
    >
      {saved ? (
        <div className="grid gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p role="status" className="text-sm font-medium">
            Application saved for {saved.company}.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/applications/${saved.id}`} className="underline">
              View application
            </Link>
            {!saved.continuing ? (
              <Button variant="outline" size="sm" onClick={() => restart(saved.next)}>
                Log another application
              </Button>
            ) : null}
          </div>
          {saved.continuing ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Set a follow-up for {saved.company}</summary>
              <div className="mt-3">
                <FollowUpShortcuts applicationId={saved.id} today={localDateIn(new Date(), props.timezone ?? "UTC")} />
              </div>
            </details>
          ) : (
            <FollowUpShortcuts applicationId={saved.id} today={localDateIn(new Date(), props.timezone ?? "UTC")} />
          )}
        </div>
      ) : null}
      {!saved || saved.continuing || props.mode === "edit" ? (
        <>
          <ApplicationFormFields
            key={epoch}
            {...props}
            initial={props.mode === "edit" ? props.initial : initial}
            idem={idem}
            onCreated={created}
            onSuggestion={accept}
            draftMessage={draftMessage}
            onDiscard={() => restart()}
          />
        </>
      ) : null}
    </div>
  );
}
