import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { extractJobSuggestion } from "@/lib/applications/job-prefill";
import { readPublicPage } from "@/lib/server/public-page";
import { isSameOrigin, jsonError, noStore } from "@/lib/server/http";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "origin", "Not allowed.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, "unauthorized", "Sign in to preview job details.");
  const parsed = z.object({ url: z.string().url().max(500) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "invalid_url", "Enter a public HTTPS job link.");
  try {
    const suggestion = extractJobSuggestion(await readPublicPage(parsed.data.url), parsed.data.url);
    if (!Object.values(suggestion).some(Boolean))
      return jsonError(422, "no_details", "This site does not expose readable job details. Enter them manually.");
    return NextResponse.json({ suggestion }, { headers: noStore() });
  } catch {
    return jsonError(422, "preview_failed", "Could not read this public job page. You can enter the details manually.");
  }
}
