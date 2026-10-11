import { NextResponse } from "next/server";
import { getWorkspaceForApi } from "@/lib/auth/session";
import { dbErrorStatus, isSameOrigin, jsonError, noStore } from "@/lib/server/http";
import { createGithubClient } from "@/lib/discovery/github";
import { createSourceFetcher } from "@/lib/discovery/fetcher";
import { connectFromEnv, discoveryConfigured } from "@/lib/discovery/pg-db";
import { runDiscovery } from "@/lib/discovery/run";
import { SOURCES } from "@/lib/discovery/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRESH_MS = 6 * 3600_000; // automatic checks skip a catalog refreshed within 6 hours
const FORCE_MIN_MS = 15 * 60_000; // "Refresh now" still respects a short cooldown

// Opt-in: only runs when DISCOVERY_DATABASE_URL (the restricted ingestion role) is set for the web server.
// That role can only call the catalog-ingestion functions; it cannot read any user's private data.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-origin requests are not allowed.");
  const auth = await getWorkspaceForApi();
  if (!("ctx" in auth)) return jsonError(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", "Not allowed.");
  if (!discoveryConfigured()) return jsonError(501, "not_configured", "Automatic refresh is not set up on this server.");

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = body?.force === true;
  const { supabase } = auth.ctx;

  const { data: allowed, error: rlError } = await supabase.rpc("rate_limit_user", {
    p_scope: "auto_refresh",
    p_limit: 6,
    p_window_seconds: 3600,
  });
  if (rlError) {
    const m = dbErrorStatus(rlError);
    return jsonError(m.status, m.code, m.message);
  }
  if (allowed === false) return jsonError(429, "rate_limited", "Too many refresh requests. Try again later.");

  const { data: health } = await supabase.from("feed_health").select("last_success_at");
  const last = (health ?? [])
    .map((h) => h.last_success_at)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;
  const age = last ? Date.now() - new Date(last).getTime() : Infinity;
  // New sources in code (not yet in the database) or sources that never loaded always justify a run, whatever the cooldown.
  const incomplete = (health ?? []).length < SOURCES.length || (health ?? []).some((h) => !h.last_success_at);
  if (!incomplete && age < (force ? FORCE_MIN_MS : FRESH_MS))
    return NextResponse.json({ status: "fresh", last_success_at: last }, { headers: noStore() });

  let connectError: string | null = null;
  const conn = await connectFromEnv().catch((e: unknown) => {
    connectError = String((e as { code?: string } | null)?.code ?? "unknown");
    return null;
  });
  if (!conn)
    return jsonError(502, "db_unavailable", `Could not reach the catalog database (${connectError ?? "check DISCOVERY_DATABASE_URL"}).`);
  try {
    const summary = await runDiscovery({
      db: conn.db,
      fetcher: createSourceFetcher(createGithubClient({ token: process.env.GITHUB_TOKEN || null })),
      now: () => new Date(),
      trigger: "manual",
      correlationId: null,
      runnerId: "web-auto",
    });
    if (summary.state === "skipped_overlap") return NextResponse.json({ status: "running" }, { status: 202, headers: noStore() });
    const ok = summary.state === "success" || summary.state === "partial";
    return NextResponse.json(
      { status: ok ? "refreshed" : "failed", state: summary.state, new_jobs: summary.counts.new_jobs ?? 0 },
      { status: ok ? 200 : 502, headers: noStore() },
    );
  } catch (e) {
    const code = String((e as { code?: string } | null)?.code ?? "unknown");
    console.error(`auto-refresh failed code=${code}`);
    return jsonError(500, "refresh_failed", `The refresh did not complete (${code}).`);
  } finally {
    await conn.close().catch(() => undefined);
  }
}
