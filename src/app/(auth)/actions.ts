"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/server/env";
import { allowPublicAction } from "@/lib/server/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { emailSchema, passwordSchema, fieldErrors, formToObject, stringValues, checkbox } from "@/lib/validation/common";
import type { FormState } from "@/components/forms/fields";

const GENERIC_RATE = "Too many attempts. Please wait a few minutes and try again.";

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  terms: checkbox.refine((v) => v, "You must accept the terms and privacy policy."),
});

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const env = getEnv();
  if (env.REGISTRATION_MODE !== "public") {
    return { status: "error", message: "Registration is currently limited to invited testers.", values: stringValues(raw) };
  }
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: stringValues(raw) };
  if (!(await allowPublicAction("signup", parsed.data.email))) return { status: "error", message: GENERIC_RATE, values: stringValues(raw) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${env.APP_URL}/auth/callback?next=/dashboard`, data: { terms_version: env.TERMS_VERSION } },
  });
  if (error && (error.code === "weak_password" || error.status === 422)) {
    return { status: "error", fields: { password: ["Choose a stronger password."] }, values: stringValues(raw) };
  }
  // Same response whether or not the address is already registered (no account enumeration).
  return {
    status: "ok",
    message: "If this address can be registered, we have sent a verification link. Check your inbox (and spam), then log in.",
  };
}

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(200) });

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: stringValues(raw) };
  if (!(await allowPublicAction("login", parsed.data.email))) return { status: "error", message: GENERIC_RATE, values: stringValues(raw) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Please verify your email first. Use “Resend verification” on the next page.",
        values: stringValues(raw),
      };
    }
    return { status: "error", message: "Invalid email or password.", values: stringValues(raw) };
  }
  redirect(safeNextPath(typeof raw.next === "string" ? raw.next : null));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = z.object({ email: emailSchema }).safeParse(raw);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: stringValues(raw) };
  if (!(await allowPublicAction("recovery", parsed.data.email)))
    return { status: "error", message: GENERIC_RATE, values: stringValues(raw) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${getEnv().APP_URL}/auth/callback?next=/reset-password` });
  return { status: "ok", message: "If an account exists for that address, a reset link is on its way. The link expires, so use it soon." };
}

export async function resendVerificationAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = z.object({ email: emailSchema }).safeParse(raw);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: stringValues(raw) };
  if (!(await allowPublicAction("resend", parsed.data.email))) return { status: "error", message: GENERIC_RATE, values: stringValues(raw) };
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${getEnv().APP_URL}/auth/callback?next=/dashboard` },
  });
  return { status: "ok", message: "If that address is awaiting verification, we have sent a new link." };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." })
    .safeParse(raw);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", message: "This reset link has expired or was already used. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error)
    return {
      status: "error",
      message:
        error.code === "same_password"
          ? "Choose a password you have not used before."
          : "Could not update the password. Request a new reset link.",
    };
  await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard");
}
