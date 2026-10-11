import { headers } from "next/headers";
import { getEnv } from "@/lib/server/env";
import { sha256Hex } from "@/lib/server/http";
import { createClient } from "@/lib/supabase/server";

type Scope = "signup" | "resend" | "recovery" | "login";

const LIMITS: Record<Scope, { limit: number; window: number }> = {
  signup: { limit: 5, window: 3600 },
  resend: { limit: 3, window: 900 },
  recovery: { limit: 3, window: 900 },
  login: { limit: 10, window: 900 },
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Durable (database-backed) limiter keyed by hashed email and hashed IP. Returns false when blocked. */
export async function allowPublicAction(scope: Scope, email?: string): Promise<boolean> {
  const salt = getEnv().RATE_LIMIT_SALT;
  const supabase = await createClient();
  const { limit, window } = LIMITS[scope];
  const keys = [`ip:${await sha256Hex(`${salt}|ip|${await clientIp()}`)}`];
  if (email) keys.push(`em:${await sha256Hex(`${salt}|em|${email.trim().toLowerCase()}`)}`);
  for (const k of keys) {
    const { data, error } = await supabase.rpc("rate_limit_public", {
      p_scope: scope,
      p_key_hash: k.slice(0, 80).padEnd(16, "0"),
      p_limit: k.startsWith("ip:") ? limit * 4 : limit,
      p_window_seconds: window,
    });
    if (error) return false;
    if (data === false) return false;
  }
  return true;
}
