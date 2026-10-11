import { NextResponse } from "next/server";
import { getEnv } from "@/lib/server/env";

export type ApiError = { error: { code: string; message: string; fields?: Record<string, string[]> } };

export function jsonError(status: number, code: string, message: string, fields?: Record<string, string[]>) {
  return NextResponse.json<ApiError>({ error: { code, message, fields } }, { status, headers: noStore() });
}

export const noStore = () => ({ "Cache-Control": "private, no-store, max-age=0" });

// PostgREST maps SQLSTATE PTxyz to HTTP xyz; our RPCs raise those for domain failures.
export function dbErrorStatus(err: { code?: string; message?: string } | null | undefined): {
  status: number;
  code: string;
  message: string;
} {
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  const m = /^PT(\d{3})$/.exec(code);
  if (m)
    return {
      status: Number(m[1]),
      code: msg.split(":")[0].trim().replace(/\s+/g, "_").toLowerCase().slice(0, 48) || "error",
      message: msg,
    };
  if (code === "42501") return { status: 403, code: "forbidden", message: "Not allowed." };
  if (code === "23505") return { status: 409, code: "duplicate", message: "That record already exists." };
  if (code === "23503") return { status: 409, code: "invalid_reference", message: "Referenced record is missing or not yours." };
  if (code === "23514" || code === "22P02" || code === "22007" || code === "22008")
    return { status: 422, code: "invalid_value", message: "A value is not valid." };
  return { status: 500, code: "internal_error", message: "Something went wrong. Please try again." };
}

// Cookie-authenticated mutations on route handlers must come from our own origin.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  try {
    return new URL(origin).origin === new URL(getEnv().APP_URL).origin;
  } catch {
    return false;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
