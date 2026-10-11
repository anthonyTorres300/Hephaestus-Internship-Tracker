import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/session";
import { jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return jsonError(401, "unauthorized", "Please log in.");
  const { data } = await auth.supabase.from("account_deletion_requests").select("state, requested_at, retry_count").maybeSingle();
  if (!data) return jsonError(404, "not_found", "No deletion request.");
  return NextResponse.json({ state: data.state, requested_at: data.requested_at, retry_count: data.retry_count }, { headers: noStore() });
}
