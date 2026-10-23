import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { findApplicationDuplicates } from "@/lib/applications/duplicates";
import { isSameOrigin, jsonError, noStore } from "@/lib/server/http";
const schema = z.object({
  company_name: z.string().max(200).optional(),
  requisition_id: z.string().max(100).optional(),
  application_url: z.string().max(500).optional(),
  job_id: z.string().uuid().optional(),
});
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "origin", "Not allowed.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, "unauthorized", "Sign in to check applications.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "invalid_input", "Check the application details.");
  try {
    return NextResponse.json({ duplicates: await findApplicationDuplicates(auth.ctx.supabase, parsed.data) }, { headers: noStore() });
  } catch {
    return jsonError(500, "lookup_failed", "Could not check duplicates. Try again.");
  }
}
