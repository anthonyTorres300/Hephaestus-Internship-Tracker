"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/session";
import { setUserJob } from "@/lib/jobs/feed";
import { fieldErrors, formToObject, httpsUrl, optText } from "@/lib/validation/common";
import { JOB_PREFS_COOKIE, ROLE_GROUPS, type JobPrefs, type RoleGroup } from "@/lib/jobs/prefs";
import type { FormState } from "@/components/forms/fields";

const idOf = (fd: FormData) => z.string().uuid().parse(fd.get("job_id"));

export async function toggleSaveAction(fd: FormData) {
  const { supabase, user } = await requireWorkspace();
  await setUserJob(supabase, user.id, idOf(fd), { saved: fd.get("value") === "true" });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${fd.get("job_id")}`);
}

export async function toggleHideAction(fd: FormData) {
  const { supabase, user } = await requireWorkspace();
  await setUserJob(supabase, user.id, idOf(fd), { hidden: fd.get("value") === "true" });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${fd.get("job_id")}`);
}

// Private assertion about the employer's page; never changes the shared catalog.
export async function verifyEmployerAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireWorkspace();
  const raw = formToObject(fd);
  const p = z
    .object({
      job_id: z.string().uuid(),
      state: z.enum(["open", "closed", "none"]),
      url: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
      note: optText(1000),
    })
    .safeParse(raw);
  if (!p.success) return { status: "error", message: "Please fix the highlighted fields.", fields: fieldErrors(p.error) };
  if (p.data.state !== "none" && !p.data.url)
    return {
      status: "error",
      message: "Add the employer page you checked.",
      fields: { url: ["Required so the check can be re-verified."] },
    };
  const err = await setUserJob(
    supabase,
    user.id,
    p.data.job_id,
    p.data.state === "none"
      ? { verification_state: "none", verification_url: null, verification_note: null, verified_at: null }
      : {
          verification_state: p.data.state,
          verification_url: p.data.url ?? null,
          verification_note: p.data.note ?? null,
          verified_at: new Date().toISOString(),
        },
  );
  if (err) return { status: "error", message: "Could not save." };
  revalidatePath(`/jobs/${p.data.job_id}`);
  revalidatePath("/jobs");
  return { status: "ok", message: "Recorded privately with today's date." };
}

// Saved search defaults (role type, undergrad only) live in a first-party cookie; URL parameters can still override per search.
export async function saveJobPrefsAction(fd: FormData) {
  await requireWorkspace();
  const role = String(fd.get("role") ?? "swe");
  const prefs: JobPrefs = { role: (role in ROLE_GROUPS ? role : "swe") as RoleGroup, undergradOnly: fd.get("undergrad") === "1" };
  (await cookies()).set(JOB_PREFS_COOKIE, JSON.stringify(prefs), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/jobs");
  redirect("/jobs");
}
