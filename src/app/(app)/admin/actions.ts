"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { dbErrorStatus } from "@/lib/server/http";
import { formToObject, httpsUrl, optText } from "@/lib/validation/common";
import type { FormState } from "@/components/forms/fields";

const uuid = z.string().uuid();
const msg = (e: { code?: string; message?: string }): FormState => ({
  status: "error",
  message: dbErrorStatus(e).status === 403 ? "Not allowed." : `Failed: ${e.message?.slice(0, 120) ?? "error"}`,
});

// Every action re-checks administrator status itself; the database function checks it again.
export async function setSourceEnabledAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.rpc("admin_set_source_enabled", { p_source_id: uuid.parse(fd.get("id")), p_enabled: fd.get("enabled") === "true" });
  revalidatePath("/admin/sources");
}

export async function resolveHeldAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.rpc("admin_resolve_held_snapshot", { p_source_run_id: uuid.parse(fd.get("id")), p_approve: fd.get("approve") === "true" });
  revalidatePath("/admin/sources");
  revalidatePath("/admin/runs");
}

export async function mergeJobsAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const keep = uuid.parse(fd.get("keep")),
    merge = uuid.parse(fd.get("merge"));
  await supabase.rpc("admin_merge_jobs", { p_keep: keep, p_merge: merge });
  revalidatePath("/admin/sources");
}

export async function dismissCandidateAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.rpc("admin_dismiss_merge_candidate", { p_id: uuid.parse(fd.get("id")) });
  revalidatePath("/admin/sources");
}

export async function addVerificationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const p = z.object({ job_id: uuid, url: httpsUrl, note: optText(1000), state: z.enum(["open", "closed"]) }).safeParse(formToObject(fd));
  if (!p.success) return { status: "error", message: "Enter a valid job id and an https evidence link." };
  const { error } = await supabase.rpc("admin_add_catalog_verification", {
    p_job_id: p.data.job_id,
    p_url: p.data.url,
    p_note: p.data.note ?? null,
    p_state: p.data.state,
  });
  if (error) return msg(error);
  revalidatePath("/admin/sources");
  return { status: "ok", message: "Public evidence recorded." };
}

export async function setAccountStateAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const p = z
    .object({ user_id: uuid, state: z.enum(["active", "suspended"]), reason: z.string().trim().max(64).optional() })
    .safeParse(formToObject(fd));
  if (!p.success) return { status: "error", message: "Invalid request." };
  const { error } = await supabase.rpc("admin_set_account_state", {
    p_user: p.data.user_id,
    p_state: p.data.state,
    p_reason: p.data.reason || null,
  });
  if (error) return msg(error);
  revalidatePath("/admin/users");
  return {
    status: "ok",
    message: p.data.state === "suspended" ? "Account suspended. Existing sessions lose access immediately." : "Account reactivated.",
  };
}
