const ALLOWED_PREFIXES = ["/dashboard", "/applications", "/jobs", "/practice", "/settings", "/admin", "/reset-password"];

// Only same-site relative paths under known app sections are accepted; everything else falls back.
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string" || next.length > 300) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  let path: string;
  try {
    path = new URL(next, "http://local.invalid").pathname;
  } catch {
    return fallback;
  }
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/")) ? next : fallback;
}
