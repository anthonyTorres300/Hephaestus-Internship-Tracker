"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { requireWorkspace } from "@/lib/auth/session";
import { dbErrorStatus } from "@/lib/server/http";
import { fieldErrors, formToObject, stringValues } from "@/lib/validation/common";
import {
  createApplicationSchema,
  interviewSchema,
  noteEditSchema,
  noteSchema,
  parseSubmission,
  statusChangeSchema,
  taskSchema,
  updateApplicationSchema,
} from "@/lib/validation/application";
import { PRIORITIES, STATUSES, STATUS_LABEL, isSubmittedStatus, isValidTimezone, type Status } from "@/lib/domain";
import { normalizeSeasonName, seasonKey } from "@/lib/data/seasons";
import type { FormState } from "@/components/forms/fields";

const fail = (message: string, raw?: Record<string, string | string[]>, fields?: Record<string, string[]>): FormState => ({
  status: "error",
  message,
  fields,
  values: raw ? stringValues(raw) : undefined,
});
const dbFail = (e: { code?: string; message?: string }, raw?: Record<string, string | string[]>): FormState => {
  const m = dbErrorStatus(e);
  const text: Record<string, string> = {
    revision_conflict: "This application changed since you opened it. Reload and try again.",
    attestation_required: "Confirm that you submitted this application.",
    submission_date_required: "Enter the submission date or mark it unknown.",
    reason_required: "A reason is required to reopen an application.",
    quota_exceeded: "You have reached the application limit for your account.",
  };
  return fail(text[m.code] ?? (m.status === 500 ? m.message : "That change could not be saved."), raw);
};

export async function createApplicationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const raw = formToObject(fd);
  const parsed = createApplicationSchema.safeParse(raw);
  if (!parsed.success) return fail("Please fix the highlighted fields.", raw, fieldErrors(parsed.error));
  const d = parsed.data;
  let submission = {};
  if (isSubmittedStatus(d.status)) {
    const s = parseSubmission(d.date_known, d.submitted_day, d.submitted_month);
    if (s.error) return fail(s.error, raw, { submitted_day: [s.error] });
    submission = s.value!;
  }
  const { company_name, role_title, ...rest } = d;
  const { data, error } = await supabase.rpc("create_application", {
    p: { ...rest, company_name, role_title, ...submission, origin: d.job_id ? "job" : "manual" },
    p_key: d.idem,
  });
  if (error) return dbFail(error, raw);
  revalidatePath("/applications");
  redirect(`/applications/${(data as { id: string }).id}`);
}

export async function updateApplicationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const raw = formToObject(fd);
  const parsed = updateApplicationSchema.safeParse(raw);
  if (!parsed.success) return fail("Please fix the highlighted fields.", raw, fieldErrors(parsed.error));
  const { id, revision, date_known, submitted_day, submitted_month, ...f } = parsed.data;
  const patch: Record<string, unknown> = {
    company_name: f.company_name,
    role_title: f.role_title,
    priority: f.priority,
    application_url: f.application_url ?? null,
    portal_url: f.portal_url ?? null,
    requisition_id: f.requisition_id ?? null,
    work_mode: f.work_mode ?? null,
    role_category: f.role_category ?? null,
    season: f.season ?? null,
    season_year: f.season_year ?? null,
    locations: f.locations,
    contact_channel: f.contact_channel ?? null,
  };
  if (date_known) {
    const s = parseSubmission(date_known, submitted_day, submitted_month);
    if (s.error) return fail(s.error, raw, { submitted_day: [s.error] });
    Object.assign(patch, {
      submitted_precision: s.value!.submitted_precision,
      submitted_year: s.value!.submitted_year ?? null,
      submitted_month: s.value!.submitted_month ?? null,
      submitted_day: s.value!.submitted_day ?? null,
      submission_date_unknown: s.value!.submission_date_unknown,
    });
  }
  const { data, error } = await supabase.from("applications").update(patch).eq("id", id).eq("revision", revision).select("id");
  if (error) return dbFail(error, raw);
  if (!data?.length) return fail("This application changed since you opened it. Reload and try again.", raw);
  revalidatePath(`/applications/${id}`);
  return { status: "ok", message: "Saved." };
}

export async function changeStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const raw = formToObject(fd);
  const parsed = statusChangeSchema.safeParse(raw);
  if (!parsed.success) return fail("Please fix the highlighted fields.", raw, fieldErrors(parsed.error));
  const d = parsed.data;
  let submitted: unknown = null;
  let unknown = false;
  if (isSubmittedStatus(d.status) && d.attested) {
    const s = parseSubmission(d.date_known, d.submitted_day, d.submitted_month);
    if (s.value) {
      unknown = s.value.submission_date_unknown;
      submitted = {
        precision: s.value.submitted_precision,
        year: s.value.submitted_year,
        month: s.value.submitted_month,
        day: s.value.submitted_day,
      };
    }
  }
  const { error } = await supabase.rpc("change_application_status", {
    p_application_id: d.id,
    p_expected_revision: d.revision,
    p_new_status: d.status,
    p_reason: d.reason ?? null,
    p_effective_at: d.effective_at ? new Date(d.effective_at).toISOString() : null,
    p_attested: d.attested,
    p_submitted: submitted,
    p_submission_unknown: unknown,
    p_key: d.idem,
  });
  if (error) return dbFail(error, raw);
  revalidatePath(`/applications/${d.id}`);
  revalidatePath("/applications");
  return { status: "ok", message: "Status updated." };
}

async function simple(
  fn: (s: Awaited<ReturnType<typeof requireWorkspace>>["supabase"]) => PromiseLike<{ error: { code?: string; message?: string } | null }>,
  path: string,
  okMsg: string,
): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const { error } = await fn(supabase);
  if (error) return dbFail(error);
  revalidatePath(path);
  return { status: "ok", message: okMsg };
}

export async function addNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireWorkspace();
  const raw = formToObject(fd);
  const p = noteSchema.safeParse(raw);
  if (!p.success) return fail("Write a note first.", raw, fieldErrors(p.error));
  const { error } = await supabase.from("application_notes").insert({ user_id: user.id, ...p.data });
  if (error) return dbFail(error, raw);
  revalidatePath(`/applications/${p.data.application_id}`);
  return { status: "ok", message: "Note added." };
}

export async function editNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const p = noteEditSchema.safeParse(raw);
  if (!p.success) return fail("Write a note first.", raw, fieldErrors(p.error));
  return simple(
    (s) => s.from("application_notes").update({ body: p.data.body }).eq("id", p.data.id),
    `/applications/${p.data.application_id}`,
    "Note updated.",
  );
}

export async function deleteNoteAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("id")),
    app = String(fd.get("application_id"));
  await supabase.from("application_notes").delete().eq("id", id);
  revalidatePath(`/applications/${app}`);
}

export async function addInterviewAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireWorkspace();
  const raw = formToObject(fd);
  const p = interviewSchema.safeParse(raw);
  if (!p.success) return fail("Please fix the highlighted fields.", raw, fieldErrors(p.error));
  const tz = p.data.timezone && isValidTimezone(p.data.timezone) ? p.data.timezone : profile.timezone;
  let scheduled: string | null = null;
  if (p.data.scheduled_local) {
    const dt = DateTime.fromISO(p.data.scheduled_local, { zone: tz });
    if (!dt.isValid) return fail("Enter a valid date and time.", raw, { scheduled_local: ["Enter a valid date and time."] });
    scheduled = dt.toUTC().toISO();
  }
  const { error } = await supabase.from("interview_events").insert({
    user_id: user.id,
    application_id: p.data.application_id,
    round_number: p.data.round_number ?? 1,
    round_type: p.data.round_type ?? null,
    scheduled_at: scheduled,
    date_precision: scheduled ? "timestamp" : "unknown",
    timezone: tz,
    outcome: p.data.outcome,
    notes: p.data.notes ?? null,
  });
  if (error) return dbFail(error, raw);
  revalidatePath(`/applications/${p.data.application_id}`);
  return { status: "ok", message: "Interview round added." };
}

export async function deleteInterviewAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("id")),
    app = String(fd.get("application_id"));
  await supabase.from("interview_events").delete().eq("id", id);
  revalidatePath(`/applications/${app}`);
}

export async function updateInterviewOutcomeAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("id")),
    app = String(fd.get("application_id")),
    outcome = String(fd.get("outcome"));
  if (["pending", "passed", "failed", "cancelled", "unknown"].includes(outcome))
    await supabase.from("interview_events").update({ outcome }).eq("id", id);
  revalidatePath(`/applications/${app}`);
}

export async function addTaskAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireWorkspace();
  const raw = formToObject(fd);
  const p = taskSchema.safeParse(raw);
  if (!p.success) return fail("Please fix the highlighted fields.", raw, fieldErrors(p.error));
  const d = p.data;
  const row: Record<string, unknown> = {
    user_id: user.id,
    application_id: d.application_id ?? null,
    kind: d.kind,
    note: d.note ?? null,
    evidence: d.evidence ?? null,
    source: d.source,
    timezone: profile.timezone,
  };
  if (d.due_kind === "time") {
    const dt = DateTime.fromISO(d.due_local ?? "", { zone: profile.timezone });
    if (!dt.isValid) return fail("Enter a valid due date and time.", raw, { due_local: ["Enter a valid date and time."] });
    row.due_at = dt.toUTC().toISO();
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.due_date ?? "")) return fail("Choose a due date.", raw, { due_date: ["Choose a due date."] });
    row.due_date = d.due_date;
  }
  const { error } = await supabase.from("tasks").insert(row);
  if (error) return dbFail(error, raw);
  revalidatePath("/dashboard");
  if (d.application_id) revalidatePath(`/applications/${d.application_id}`);
  return { status: "ok", message: "Task added." };
}

// complete / dismiss / reopen / snooze. Completion is idempotent: only pending tasks transition.
export async function taskTransitionAction(fd: FormData) {
  const { supabase, profile } = await requireWorkspace();
  const id = String(fd.get("id")),
    op = String(fd.get("op")),
    app = String(fd.get("application_id") ?? "");
  if (op === "complete") await supabase.from("tasks").update({ state: "completed" }).eq("id", id).eq("state", "pending");
  else if (op === "dismiss") await supabase.from("tasks").update({ state: "dismissed" }).eq("id", id).eq("state", "pending");
  else if (op === "reopen") await supabase.from("tasks").update({ state: "pending" }).eq("id", id).neq("state", "pending");
  else if (op === "snooze") {
    const days = Math.min(30, Math.max(1, Number(fd.get("days")) || 1));
    const { data: t } = await supabase.from("tasks").select("due_date,due_at").eq("id", id).maybeSingle();
    if (t?.due_date) {
      const next = DateTime.fromISO(t.due_date, { zone: "utc" }).plus({ days }).toISODate();
      await supabase.from("tasks").update({ due_date: next }).eq("id", id).eq("state", "pending");
    } else if (t?.due_at) {
      const next = DateTime.fromISO(t.due_at, { zone: profile.timezone }).plus({ days }).toUTC().toISO();
      await supabase.from("tasks").update({ due_at: next }).eq("id", id).eq("state", "pending");
    }
  }
  revalidatePath("/dashboard");
  if (app) revalidatePath(`/applications/${app}`);
}

export async function lifecycleAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("id")),
    op = String(fd.get("op")),
    revision = Number(fd.get("revision"));
  const now = new Date().toISOString();
  const patch: Record<string, unknown> | null =
    op === "trash"
      ? { trashed_at: now }
      : op === "restore"
        ? { trashed_at: null }
        : op === "archive"
          ? { archived_at: now }
          : op === "unarchive"
            ? { archived_at: null }
            : null;
  if (patch) await supabase.from("applications").update(patch).eq("id", id).eq("revision", revision);
  if (op === "delete") await supabase.from("applications").delete().eq("id", id).not("trashed_at", "is", null);
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  if (op === "delete") redirect("/applications?view=trash");
  revalidatePath(`/applications/${id}`);
}

export type MoveResult = { ok: true; revision: number; status: string } | { ok: false; message: string };

// Drag-and-drop / "Move to" entry point: same atomic RPC and rules as the status form, returning plain data for optimistic UI.
export async function moveStatusAction(input: {
  id: string;
  revision: number;
  status: string;
  reason?: string;
  attested?: boolean;
  date_known?: string;
  submitted_day?: string;
  submitted_month?: string;
  idem: string;
}): Promise<MoveResult> {
  const { supabase } = await requireWorkspace();
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That move is not valid." };
  const d = parsed.data;
  let submitted: unknown = null;
  let unknown = false;
  if (isSubmittedStatus(d.status) && d.attested) {
    const s = parseSubmission(d.date_known, d.submitted_day, d.submitted_month);
    if (s.error) return { ok: false, message: s.error };
    unknown = s.value!.submission_date_unknown;
    submitted = {
      precision: s.value!.submitted_precision,
      year: s.value!.submitted_year,
      month: s.value!.submitted_month,
      day: s.value!.submitted_day,
    };
  }
  const { data, error } = await supabase.rpc("change_application_status", {
    p_application_id: d.id,
    p_expected_revision: d.revision,
    p_new_status: d.status,
    p_reason: d.reason ?? null,
    p_effective_at: null,
    p_attested: d.attested,
    p_submitted: submitted,
    p_submission_unknown: unknown,
    p_key: d.idem,
  });
  if (error) return { ok: false, message: dbFail(error).message ?? "That change could not be saved." };
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  const row = data as { revision: number; status: string };
  return { ok: true, revision: row.revision, status: row.status };
}

export type BulkInput = {
  ids: string[];
  set: "status" | "priority" | "season" | "archive" | "trash";
  value?: string;
  year?: number;
  reason?: string;
  attested?: boolean;
  date_known?: string;
  submitted_day?: string;
  submitted_month?: string;
};
export type BulkResult = { ok: true; changed: number; failed: number; message: string } | { ok: false; message: string };

const BULK_MAX = 200;
const uuidRe = /^[0-9a-f-]{36}$/i;

// Bulk categorize: priority / season / archive / trash are plain updates; status goes through the same atomic RPC per application.
export async function bulkUpdateAction(input: BulkInput): Promise<BulkResult> {
  const { supabase } = await requireWorkspace();
  const ids = [...new Set(input.ids)].filter((i) => uuidRe.test(i));
  if (!ids.length) return { ok: false, message: "Select at least one application." };
  if (ids.length > BULK_MAX) return { ok: false, message: `Select at most ${BULK_MAX} applications at a time.` };
  const now = new Date().toISOString();
  const touch = () => {
    revalidatePath("/applications");
    revalidatePath("/dashboard");
  };

  if (input.set === "priority" || input.set === "season" || input.set === "archive" || input.set === "trash") {
    let patch: Record<string, unknown>;
    if (input.set === "priority") {
      if (!(PRIORITIES as readonly string[]).includes(input.value ?? "")) return { ok: false, message: "Choose a priority." };
      patch = { priority: input.value };
    } else if (input.set === "season") {
      if (input.value === "none") patch = { season: null, season_year: null };
      else {
        const name = normalizeSeasonName(input.value ?? "");
        if (!name) return { ok: false, message: "Enter a season name of up to 30 characters." };
        input.value = name;
        const y = Number(input.year);
        if (!Number.isInteger(y) || y < 2000 || y > 2100) return { ok: false, message: "Enter a valid year." };
        patch = { season: input.value, season_year: y };
      }
    } else patch = input.set === "archive" ? { archived_at: now } : { trashed_at: now };
    const { data, error } = await supabase.from("applications").update(patch).in("id", ids).select("id");
    if (error) return { ok: false, message: "Those changes could not be saved." };
    touch();
    const n = data?.length ?? 0;
    return { ok: true, changed: n, failed: ids.length - n, message: `Updated ${n} application${n === 1 ? "" : "s"}.` };
  }

  if (!(STATUSES as readonly string[]).includes(input.value ?? "")) return { ok: false, message: "Choose a status." };
  const to = input.value as Status;
  let submitted: unknown = null;
  let unknown = false;
  if (isSubmittedStatus(to) && input.attested) {
    const s = parseSubmission(input.date_known ?? "unknown", input.submitted_day, input.submitted_month);
    if (s.error) return { ok: false, message: s.error };
    unknown = s.value!.submission_date_unknown;
    submitted = {
      precision: s.value!.submitted_precision,
      year: s.value!.submitted_year,
      month: s.value!.submitted_month,
      day: s.value!.submitted_day,
    };
  }
  const { data: rows, error: readErr } = await supabase.from("applications").select("id, revision, status").in("id", ids);
  if (readErr) return { ok: false, message: "Could not load the selected applications." };
  let changed = 0;
  let failed = 0;
  const todo = (rows ?? []).filter((r) => r.status !== to);
  for (let i = 0; i < todo.length; i += 8) {
    const results = await Promise.all(
      todo.slice(i, i + 8).map((r) =>
        supabase.rpc("change_application_status", {
          p_application_id: r.id,
          p_expected_revision: r.revision,
          p_new_status: to,
          p_reason: input.reason?.trim() || null,
          p_effective_at: null,
          p_attested: input.attested === true,
          p_submitted: submitted,
          p_submission_unknown: unknown,
          p_key: crypto.randomUUID(),
        }),
      ),
    );
    for (const r of results) {
      if (r.error) failed++;
      else changed++;
    }
  }
  touch();
  const skipped = (rows ?? []).length - todo.length;
  const parts = [`Moved ${changed} to ${STATUS_LABEL[to]}.`];
  if (skipped) parts.push(`${skipped} already had that status.`);
  if (failed)
    parts.push(
      `${failed} could not be moved (a closed application needs a reason to reopen, and submitted ones cannot go back to Saved or Prepared).`,
    );
  return { ok: true, changed, failed, message: parts.join(" ") };
}

export type SeasonResult = { ok: true; key: string } | { ok: false; message: string };

// Creates a season so it gets its own tab, even before any application uses it.
export async function createSeasonAction(input: { name: string; year: number }): Promise<SeasonResult> {
  const { supabase, user } = await requireWorkspace();
  const name = normalizeSeasonName(input.name ?? "");
  const year = Number(input.year);
  if (!name) return { ok: false, message: "Enter a season name of up to 30 characters." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, message: "Enter a year between 2000 and 2100." };
  const { error } = await supabase
    .from("user_seasons")
    .upsert({ user_id: user.id, name, year }, { onConflict: "user_id,name,year", ignoreDuplicates: true });
  if (error) {
    const m = dbErrorStatus(error);
    return { ok: false, message: m.status === 429 ? "You can have up to 40 custom seasons." : "Could not create the season." };
  }
  revalidatePath("/applications");
  return { ok: true, key: seasonKey(name, year) };
}

// Removes an empty season's tab. Applications are never touched; the page only offers this when the season has none.
export async function deleteSeasonAction(input: { name: string; year: number }): Promise<{ ok: boolean; message?: string }> {
  const { supabase, user } = await requireWorkspace();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("season", input.name)
    .eq("season_year", input.year)
    .is("trashed_at", null)
    .is("archived_at", null);
  if (count) return { ok: false, message: "This season still has applications. Move them to another season first." };
  const { error } = await supabase.from("user_seasons").delete().eq("user_id", user.id).eq("name", input.name).eq("year", input.year);
  if (error) return { ok: false, message: "Could not remove the season." };
  revalidatePath("/applications");
  return { ok: true };
}
