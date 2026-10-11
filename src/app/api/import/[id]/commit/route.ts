import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { dbErrorStatus, isSameOrigin, jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Atomic and idempotent: a retried commit of the same batch returns the stored result.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-origin requests are not allowed.");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "not_found", "Not found.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  const { data, error } = await auth.ctx.supabase.rpc("commit_import_batch", { p_batch_id: id });
  if (error) {
    const m = dbErrorStatus(error);
    const msg =
      m.code === "unresolved_rows"
        ? "Some rows still need a fix, a decision, or to be skipped."
        : m.status === 429
          ? "This import would exceed your 2,000 application limit."
          : m.status === 404
            ? "Not found."
            : m.message;
    return jsonError(m.status, m.code, msg);
  }
  return NextResponse.json({ summary: data }, { headers: noStore() });
}
