import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { dbErrorStatus, isSameOrigin, jsonError, noStore } from "@/lib/server/http";
import { ImportLimitError, MAX_BYTES, fileHash, mapColumns, parseTable, stageRows } from "@/lib/import";
import { existingApps, insertRows, rowsToStorage, type BatchSummary } from "@/lib/data/import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-origin requests are not allowed.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  const { supabase, user } = auth.ctx;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024)
    return jsonError(413, "too_large", "The import is larger than 5 MB.");
  if (!request.headers.get("content-type")?.includes("multipart/form-data"))
    return jsonError(415, "unsupported_media_type", "Send multipart form data.");
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError(422, "invalid_request", "Could not read the upload.");

  const file = form.get("file");
  const pasted = form.get("pasted");
  let bytes: Uint8Array;
  let name: string | null = null;
  let source: "file" | "paste" = "paste";
  if (file instanceof File && file.size > 0) {
    bytes = new Uint8Array(await file.arrayBuffer());
    name = file.name.slice(0, 255);
    source = "file";
  } else if (typeof pasted === "string" && pasted.trim()) bytes = new TextEncoder().encode(pasted);
  else return jsonError(422, "empty", "Choose a CSV/TSV file or paste table rows.");
  if (bytes.byteLength > MAX_BYTES) return jsonError(413, "too_large", "The import is larger than 5 MB.");

  let table;
  try {
    table = parseTable(new TextDecoder("utf-8").decode(bytes));
  } catch (e) {
    if (e instanceof ImportLimitError)
      return jsonError(413, e.code, e.code === "too_many_rows" ? "Imports are limited to 5,000 rows." : "The import is larger than 5 MB.");
    return jsonError(422, "unreadable", "Could not read this file as CSV or TSV.");
  }
  const columnMap = mapColumns(table.headers);
  if (columnMap.company_name == null || columnMap.role_title == null) {
    return jsonError(
      422,
      "missing_columns",
      `Could not find the “Company Name” and “Position Applied For” columns. Found: ${table.headers.slice(0, 12).join(", ") || "(none)"}. Use the template.`,
    );
  }

  const hash = fileHash(bytes);
  const newReview = form.get("new_review") === "on";
  const { data: prior } = await supabase
    .from("import_batches")
    .select("id, review_round, state")
    .eq("file_hash", hash)
    .eq("mapping_version", "1")
    .order("review_round", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prior && !newReview) return NextResponse.json({ batch_id: prior.id, repeated: true, state: prior.state }, { headers: noStore() });

  const staged = stageRows(table, { columnMap, existing: await existingApps(supabase), attestSubmitted: true });
  if (staged.length === 0) return jsonError(422, "empty", "No data rows were found.");
  const summary: BatchSummary = {
    headers: table.headers,
    columnMap,
    statusMap: {},
    delimiter: table.delimiter,
    nonblank: staged.length,
    source,
  };
  const { data: batch, error } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      file_name: name,
      file_hash: hash,
      mapping_version: "1",
      review_round: (prior?.review_round ?? 0) + 1,
      summary,
    })
    .select("id")
    .single();
  if (error) {
    const m = dbErrorStatus(error);
    return jsonError(
      m.status,
      m.code,
      m.status === 429 ? "You can create 5 previews per hour. Please try again later." : "Could not stage the import.",
    );
  }
  const err = await insertRows(supabase, user.id, batch.id, rowsToStorage(staged, {}));
  if (err) {
    await supabase.from("import_batches").update({ state: "cancelled" }).eq("id", batch.id);
    return jsonError(500, "stage_failed", "Could not stage the rows. Nothing was imported.");
  }
  return NextResponse.json({ batch_id: batch.id, repeated: false, rows: staged.length }, { status: 201, headers: noStore() });
}
