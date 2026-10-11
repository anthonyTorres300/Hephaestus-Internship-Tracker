"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { requireWorkspace } from "@/lib/auth/session";
import { dbErrorStatus } from "@/lib/server/http";
import { fieldErrors, formToObject, stringValues } from "@/lib/validation/common";
import { attemptSchema, leetcodeSlug } from "@/lib/validation/practice";
import { LEETCODE_USERNAME, fetchLeetCodeProfile } from "@/lib/leetcode/client";
import type { FormState } from "@/components/forms/fields";

export async function logAttemptAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireWorkspace();
  const raw = formToObject(fd);
  const p = attemptSchema.safeParse(raw);
  if (!p.success)
    return { status: "error", message: "Please fix the highlighted fields.", fields: fieldErrors(p.error), values: stringValues(raw) };
  const d = p.data;

  const when = DateTime.fromISO(d.practiced_local.length === 10 ? `${d.practiced_local}T12:00` : d.practiced_local, {
    zone: profile.timezone,
  });
  if (!when.isValid)
    return {
      status: "error",
      message: "Choose a valid date.",
      fields: { practiced_local: ["Choose a valid date."] },
      values: stringValues(raw),
    };

  // Revisiting a known problem adds an attempt; it never adds a distinct problem.
  const slug = leetcodeSlug(d.url);
  let problemId: string | null = null;
  if (slug) {
    const { data } = await supabase.from("practice_problems").select("id").eq("platform", "leetcode").eq("slug", slug).maybeSingle();
    problemId = data?.id ?? null;
  }
  if (!problemId) {
    const { data } = await supabase
      .from("practice_problems")
      .select("id")
      .ilike("title", d.title.replace(/[%_]/g, "\\$&"))
      .limit(1)
      .maybeSingle();
    problemId = data?.id ?? null;
  }
  if (!problemId) {
    const { data, error } = await supabase
      .from("practice_problems")
      .insert({
        user_id: user.id,
        title: d.title,
        slug,
        url: d.url ?? null,
        difficulty: d.difficulty,
      })
      .select("id")
      .single();
    if (error) {
      const m = dbErrorStatus(error);
      return {
        status: "error",
        message: m.status === 429 ? "You have reached the problem limit for your account." : "Could not save the problem.",
        values: stringValues(raw),
      };
    }
    problemId = data.id;
    if (d.topic_ids.length)
      await supabase.from("problem_topics").insert(d.topic_ids.map((topic_id) => ({ problem_id: problemId, user_id: user.id, topic_id })));
  } else {
    // Existing problem: fill in missing difficulty/topics without overwriting what is already recorded.
    if (d.difficulty !== "unknown")
      await supabase.from("practice_problems").update({ difficulty: d.difficulty }).eq("id", problemId).eq("difficulty", "unknown");
    if (d.topic_ids.length)
      await supabase.from("problem_topics").upsert(
        d.topic_ids.map((topic_id) => ({ problem_id: problemId, user_id: user.id, topic_id })),
        { onConflict: "problem_id,topic_id", ignoreDuplicates: true },
      );
  }

  const { error } = await supabase.from("practice_attempts").insert({
    user_id: user.id,
    problem_id: problemId,
    practiced_at: when.toUTC().toISO(),
    duration_minutes: d.duration_unknown ? null : (d.duration_minutes ?? null),
    duration_unknown: d.duration_unknown,
    language: d.language ?? profile.preferred_language,
    result: d.result,
    confidence: d.confidence ?? null,
    notes: d.notes ?? null,
    next_review_date: d.next_review_date ?? null,
  });
  if (error) {
    const m = dbErrorStatus(error);
    return {
      status: "error",
      message: m.status === 429 ? "You have reached the attempt limit. Export your data to make room." : "Could not save the attempt.",
      values: stringValues(raw),
    };
  }
  revalidatePath("/practice");
  revalidatePath("/dashboard");
  return { status: "ok", message: "Attempt logged." };
}

export async function deleteAttemptAction(fd: FormData) {
  const { supabase } = await requireWorkspace();
  await supabase
    .from("practice_attempts")
    .delete()
    .eq("id", String(fd.get("id")));
  revalidatePath("/practice");
}

export async function updateProblemAction(fd: FormData) {
  const { supabase, user } = await requireWorkspace();
  const id = String(fd.get("id")),
    difficulty = String(fd.get("difficulty"));
  if (["easy", "medium", "hard", "unknown"].includes(difficulty))
    await supabase.from("practice_problems").update({ difficulty }).eq("id", id);
  const topics = fd
    .getAll("topic_ids")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  await supabase.from("problem_topics").delete().eq("problem_id", id);
  if (topics.length)
    await supabase.from("problem_topics").insert(topics.map((topic_id) => ({ problem_id: id, user_id: user.id, topic_id })));
  revalidatePath("/practice");
}

// Stores only the public LeetCode username (in the user's own auth metadata). Empty value disconnects.
export async function saveLeetCodeAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireWorkspace();
  const username = String(fd.get("username") ?? "").trim();
  if (username && !LEETCODE_USERNAME.test(username)) {
    return {
      status: "error",
      message: "Use your LeetCode username: letters, numbers, - and _ only.",
      fields: { username: ["Not a valid username."] },
      values: { username },
    };
  }
  if (username) {
    const check = await fetchLeetCodeProfile(username);
    if (!check.ok && check.reason === "not_found") {
      return {
        status: "error",
        message: "LeetCode has no public profile with that username.",
        fields: { username: ["Not found."] },
        values: { username },
      };
    }
  }
  const { error } = await supabase.auth.updateUser({ data: { leetcode_username: username || null } });
  if (error) return { status: "error", message: "Could not save. Please try again.", values: { username } };
  revalidatePath("/practice");
  return { status: "ok", message: username ? "Connected." : "Disconnected." };
}
