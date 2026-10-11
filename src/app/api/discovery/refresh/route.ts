import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { getEnv } from "@/lib/server/env";
import { dbErrorStatus, isSameOrigin, jsonError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Administrator-only. Dispatches ONE fixed workflow in the configured repo; accepts no repo/workflow/URL input.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-origin requests are not allowed.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  if (!auth.ctx.isAdmin) return jsonError(403, "forbidden", "Administrators only.");

  const env = getEnv();
  if (!env.GITHUB_WORKFLOW_DISPATCH_TOKEN || !env.GITHUB_WORKFLOW_REPO) {
    return jsonError(
      501,
      "dispatch_not_configured",
      "Manual refresh is not configured. Run the “discovery” workflow from the repository's Actions tab instead.",
    );
  }
  const correlation = randomUUID();
  const { error } = await auth.ctx.supabase.rpc("admin_claim_refresh", { p_correlation: correlation });
  if (error) {
    const m = dbErrorStatus(error);
    return jsonError(
      m.status,
      m.code === "cooldown" ? "cooldown" : m.code,
      m.code === "cooldown" ? "A refresh was requested in the last 15 minutes." : m.message,
    );
  }

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_WORKFLOW_REPO}/actions/workflows/discovery.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_WORKFLOW_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { correlation_id: correlation } }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || res.status !== 204)
    return jsonError(502, "dispatch_failed", "GitHub did not accept the dispatch. Check the token and repository settings.");
  return NextResponse.json({ accepted: true, correlation_id: correlation }, { status: 202, headers: noStore() });
}
