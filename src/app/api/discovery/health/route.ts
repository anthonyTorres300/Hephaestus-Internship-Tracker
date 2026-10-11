import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  const { data, error } = await auth.ctx.supabase.from("feed_health").select("repository, attribution, last_success_at, stale");
  if (error) return jsonError(500, "internal_error", "Could not load feed health.");
  return NextResponse.json({ sources: data }, { headers: noStore() });
}
