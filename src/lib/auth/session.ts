import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/server/env";
import type { Profile } from "@/lib/data/types";

export type AccountState = "active" | "suspended" | "deletion_requested";

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

export interface WorkspaceContext extends AuthContext {
  profile: Profile;
  isAdmin: boolean;
}

// getUser() asks the Auth server to verify the token; cached per request.
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
});

export const getAccountState = cache(async (): Promise<AccountState | null> => {
  const auth = await getAuth();
  if (!auth) return null;
  let { data } = await auth.supabase.from("account_states").select("state").maybeSingle();
  if (!data) {
    await auth.supabase.rpc("ensure_account");
    ({ data } = await auth.supabase.from("account_states").select("state").maybeSingle());
  }
  return (data?.state as AccountState | undefined) ?? null;
});

/** Every protected page, action and route calls this itself; the proxy redirect is only a convenience. */
export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  if (!isConfigured()) redirect("/setup");
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.user.email_confirmed_at) redirect("/verify-email");
  const state = await getAccountState();
  if (state !== "active") redirect("/account-status");
  const [{ data: profile }, { data: admin }] = await Promise.all([
    auth.supabase.from("profiles").select("*").maybeSingle(),
    auth.supabase.rpc("is_admin"),
  ]);
  if (!profile) redirect("/account-status");
  return { ...auth, profile: profile as Profile, isAdmin: admin === true };
});

export async function requireAdmin(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (!ctx.isAdmin) redirect("/dashboard");
  return ctx;
}

/** Non-redirecting variant for route handlers (return 401/403 instead). */
export async function getWorkspaceForApi(): Promise<{ ctx: WorkspaceContext } | { status: 401 | 403 }> {
  const auth = await getAuth();
  if (!auth) return { status: 401 };
  if (!auth.user.email_confirmed_at) return { status: 403 };
  const state = await getAccountState();
  if (state !== "active") return { status: 403 };
  const [{ data: profile }, { data: admin }] = await Promise.all([
    auth.supabase.from("profiles").select("*").maybeSingle(),
    auth.supabase.rpc("is_admin"),
  ]);
  if (!profile) return { status: 403 };
  return { ctx: { ...auth, profile: profile as Profile, isAdmin: admin === true } };
}
