import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth/session";
import { dbErrorStatus, isSameOrigin, jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Reauthenticated, idempotent, session-user only. Accepts no user id. Cleanup itself runs in the lifecycle worker.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-origin requests are not allowed.");
  if (!request.headers.get("content-type")?.includes("application/json")) return jsonError(415, "unsupported_media_type", "Send JSON.");
  const auth = await getAuth();
  if (!auth || !auth.user.email) return jsonError(401, "unauthorized", "Please log in again.");

  const parsed = z
    .object({ password: z.string().min(1).max(200), confirm: z.literal("DELETE") })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "invalid_request", "Enter your password and type DELETE to confirm.");

  const { data: ok } = await auth.supabase.rpc("rate_limit_user", { p_scope: "account_delete", p_limit: 5, p_window_seconds: 900 });
  if (ok === false) return jsonError(429, "rate_limited", "Too many attempts. Please wait a few minutes.");

  const { error: reauth } = await auth.supabase.auth.signInWithPassword({ email: auth.user.email, password: parsed.data.password });
  if (reauth) return jsonError(403, "reauth_failed", "That password is not correct.");

  const { data, error } = await auth.supabase.rpc("request_account_deletion");
  if (error) {
    const m = dbErrorStatus(error);
    return jsonError(m.status, m.code, m.message);
  }
  await auth.supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ ok: true, request: data }, { status: 202, headers: noStore() });
}
