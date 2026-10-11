import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkEnv } from "@/lib/server/env";

const PROTECTED = ["/dashboard", "/applications", "/jobs", "/practice", "/settings", "/admin"];

export const isProtectedPath = (p: string) => PROTECTED.some((x) => p === x || p.startsWith(x + "/"));

// Refreshes the auth cookie and does an optimistic redirect. Real authorization happens again in each page/action/route.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = checkEnv();
  if (!env.ok) return response;

  const supabase = createServerClient(env.env.NEXT_PUBLIC_SUPABASE_URL, env.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
