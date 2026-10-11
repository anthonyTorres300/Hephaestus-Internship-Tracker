import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  APP_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  REGISTRATION_MODE: z.enum(["closed_pilot", "public"]).default("public"),
  SUPPORT_EMAIL: z.string().email().optional(),
  RATE_LIMIT_SALT: z.string().min(16).default("dev-only-rate-limit-salt"),
  TERMS_VERSION: z.string().min(1).max(32).default("2026-10-10"),
  GITHUB_WORKFLOW_DISPATCH_TOKEN: z.string().optional(),
  GITHUB_WORKFLOW_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export type EnvCheck = { ok: true; env: ServerEnv } | { ok: false; problems: string[] };

// NEXT_PUBLIC_* must be referenced literally so Next inlines them for the browser bundle.
export function checkEnv(): EnvCheck {
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    APP_URL: process.env.APP_URL || undefined,
    REGISTRATION_MODE: process.env.REGISTRATION_MODE || undefined,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || undefined,
    RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT || undefined,
    TERMS_VERSION: process.env.TERMS_VERSION || undefined,
    GITHUB_WORKFLOW_DISPATCH_TOKEN: process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN || undefined,
    GITHUB_WORKFLOW_REPO: process.env.GITHUB_WORKFLOW_REPO || undefined,
  });
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

export function getEnv(): ServerEnv {
  const r = checkEnv();
  if (!r.ok) {
    throw new Error(`Invalid environment configuration. Copy .env.example to .env.local and set: ${r.problems.join("; ")}`);
  }
  return r.env;
}

export function isConfigured(): boolean {
  return checkEnv().ok;
}
