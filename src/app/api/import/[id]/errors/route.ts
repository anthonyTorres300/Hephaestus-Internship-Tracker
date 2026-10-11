import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { jsonError, noStore } from "@/lib/server/http";
import { toCsv, exportFilename } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "not_found", "Not found.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  const { data, error } = await auth.ctx.supabase
    .from("import_rows")
    .select("ordinal, proposed, errors, warnings, decision, outcome")
    .eq("batch_id", id)
    .order("ordinal")
    .limit(5000);
  if (error || !data) return jsonError(404, "not_found", "Not found.");
  const rows = data.filter(
    (r) => (r.errors as unknown[]).length || r.outcome === "failed" || r.outcome === "skipped" || r.decision === "skip",
  );
  const msg = (x: unknown) => (Array.isArray(x) ? x.map((i: { message?: string; code?: string }) => i.message ?? i.code).join("; ") : "");
  const body = toCsv(
    ["row", "company", "role", "decision", "outcome", "errors", "warnings"],
    rows.map((r) => [
      r.ordinal,
      (r.proposed as { company_name?: string }).company_name,
      (r.proposed as { role_title?: string }).role_title,
      r.decision,
      r.outcome,
      msg(r.errors),
      msg(r.warnings),
    ]),
    { bom: true },
  );
  return new NextResponse(body, {
    headers: {
      ...noStore(),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("import-report", "csv")}"`,
    },
  });
}
