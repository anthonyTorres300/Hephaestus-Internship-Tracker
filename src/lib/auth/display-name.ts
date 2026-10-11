import type { User } from "@supabase/supabase-js";

// Display name lives in the user's own auth metadata; it is only ever shown back to that user.
export function displayName(user: Pick<User, "user_metadata">): string | null {
  const raw = (user.user_metadata as { display_name?: unknown } | undefined)?.display_name;
  const name = typeof raw === "string" ? raw.trim() : "";
  return name ? name.slice(0, 40) : null;
}

export function leetcodeUsername(user: Pick<User, "user_metadata">): string | null {
  const raw = (user.user_metadata as { leetcode_username?: unknown } | undefined)?.leetcode_username;
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,30}$/.test(raw) ? raw : null;
}
