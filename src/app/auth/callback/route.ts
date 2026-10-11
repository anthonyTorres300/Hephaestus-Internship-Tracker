import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/server/env";
import { safeNextPath } from "@/lib/auth/redirect";

// Handles PKCE `code` links and token_hash links. `next` is validated against a local allowlist (no open redirects).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getEnv().APP_URL;
  const next = safeNextPath(searchParams.get("next"), "/dashboard");
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  if (!ok) return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  return NextResponse.redirect(`${origin}${next}`);
}
