"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { restageBatch } from "@/lib/data/import";
import { STATUSES } from "@/lib/domain";
import type { AppStatus } from "@/lib/import/status";
import type { FormState } from "@/components/forms/fields";

const uuid = /^[0-9a-f-]{36}$/i;

// Applies edited status mappings and per-row corrections, then re-runs validation on every row.
export async function restageAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireWorkspace();
  const id = String(fd.get("batch_id"));
  if (!uuid.test(id)) return { status: "error", message: "Not found." };
  const statusMap: Record<string, AppStatus> = {};
  const overrides: Record<number, Record<string, string>> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (k.startsWith("map:") && v && (STATUSES as readonly string[]).includes(v)) statusMap[k.slice(4).toLowerCase()] = v as AppStatus;
    const m = /^ov:(\d+):(\w+)$/.exec(k);
    if (m && v.trim()) (overrides[Number(m[1])] ??= {})[m[2]] = v.trim().slice(0, 200);
  }
  const r = await restageBatch(supabase, user.id, id, { statusMap, overrides });
  if ("error" in r) return { status: "error", message: "Could not re-check the rows. Reload and try again." };
  revalidatePath(`/applications/import/${id}`);
  return { status: "ok", message: "Rows re-checked." };
}

export async function saveDecisionsAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("batch_id"));
  if (!uuid.test(id)) return { status: "error", message: "Not found." };
  const op = String(fd.get("op") ?? "save");
  if (op === "accept_clean") {
    await supabase
      .from("import_rows")
      .update({ decision: "accept" })
      .eq("batch_id", id)
      .eq("decision", "pending")
      .eq("errors", "[]")
      .eq("warnings", "[]");
  } else if (op === "skip_errors") {
    await supabase.from("import_rows").update({ decision: "skip" }).eq("batch_id", id).neq("errors", "[]");
  } else {
    for (const [k, v] of fd.entries()) {
      const m = /^d:(\d+)$/.exec(k);
      if (m && typeof v === "string" && ["pending", "accept", "skip"].includes(v))
        await supabase.from("import_rows").update({ decision: v }).eq("batch_id", id).eq("ordinal", Number(m[1]));
    }
  }
  revalidatePath(`/applications/import/${id}`);
  return { status: "ok", message: "Saved." };
}

export async function cancelBatchAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("batch_id"));
  if (uuid.test(id)) await supabase.from("import_batches").update({ state: "cancelled" }).eq("id", id);
  revalidatePath("/applications/import");
}

export async function undoBatchAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const id = String(fd.get("batch_id"));
  const { data, error } = await supabase.rpc("undo_import_batch", { p_batch_id: id });
  if (error) return { status: "error", message: "Could not undo this import." };
  revalidatePath("/applications/import");
  revalidatePath(`/applications/import/${id}`);
  revalidatePath("/applications");
  const d = data as { trashed: number; kept_for_review: number };
  return {
    status: "ok",
    message: `Moved ${d.trashed} unchanged application(s) to trash. ${d.kept_for_review} edited or linked record(s) were kept for your review.`,
  };
}
