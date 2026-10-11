"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { isValidTimezone } from "@/lib/domain";
import type { FormState } from "@/components/forms/fields";

// One-time, silent: store the browser's time zone so due dates, weeks and streaks use the right local day.
export async function syncTimezoneAction(tz: string) {
  const { supabase, user, profile } = await requireWorkspace();
  if (profile.timezone_confirmed || typeof tz !== "string" || tz.length > 64 || !isValidTimezone(tz)) return;
  await supabase.from("profiles").update({ timezone: tz, timezone_confirmed: true }).eq("user_id", user.id);
}

export async function saveNameAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const name = String(fd.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length > 40)
    return { status: "error", message: "Use 40 characters or fewer.", fields: { name: ["Use 40 characters or fewer."] }, values: { name } };
  const { error } = await supabase.auth.updateUser({ data: { display_name: name || null } });
  if (error) return { status: "error", message: "Could not save your name. Please try again.", values: { name } };
  revalidatePath("/", "layout");
  return { status: "ok", message: name ? `Saved. Hello, ${name}!` : "Name removed." };
}
