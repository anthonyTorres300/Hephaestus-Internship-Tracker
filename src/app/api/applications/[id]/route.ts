import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { getApplicationDetail } from "@/lib/data/applications";
import { jsonError, noStore } from "@/lib/server/http";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, "unauthorized", "Sign in to view this application.");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "not_found", "Application not found.");
  const detail = await getApplicationDetail(auth.ctx.supabase, id);
  if (!detail) return jsonError(404, "not_found", "Application not found.");
  return NextResponse.json(
    { app: detail.app, notes: detail.notes, tasks: detail.tasks, timezone: auth.ctx.profile.timezone },
    { headers: noStore() },
  );
}
