import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { jsonError, noStore } from "@/lib/server/http";
import { fetchAll, OWNER_TABLES } from "@/lib/data/export";
import { applicationsToCsv, exportFilename, ownerExportJson, type ExportApplication } from "@/lib/export";

export const dynamic = "force-dynamic";

// Owner-only: every query runs as the signed-in user, so RLS limits rows; ownerExportJson also rejects foreign user_ids.
export async function GET(request: Request) {
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  const { supabase, user, profile } = auth.ctx;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "json") return jsonError(422, "invalid_format", "format must be csv or json.");

  try {
    const apps = await fetchAll<ExportApplication & { user_id: string }>(supabase, "applications");
    const now = new Date();
    if (format === "csv") {
      const notes = await fetchAll<{ application_id: string }>(supabase, "application_notes");
      const noteCounts: Record<string, number> = {};
      for (const n of notes) noteCounts[n.application_id] = (noteCounts[n.application_id] ?? 0) + 1;
      const body = applicationsToCsv(apps, { now, noteCounts }, { bom: true });
      return new NextResponse(body, {
        headers: {
          ...noStore(),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exportFilename("applications", "csv", now)}"`,
        },
      });
    }
    const collections: Record<string, unknown[]> = { applications: apps };
    for (const t of OWNER_TABLES)
      if (t !== "applications") collections[t] = await fetchAll(supabase, t, t === "problem_topics" ? "problem_id" : "id");
    const body = JSON.stringify(ownerExportJson({ user_id: user.id, now, profile: { ...profile }, ...collections }), null, 2);
    return new NextResponse(body, {
      headers: {
        ...noStore(),
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename("full-export", "json", now)}"`,
      },
    });
  } catch {
    return jsonError(500, "export_failed", "Export failed. Please try again.");
  }
}
