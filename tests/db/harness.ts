import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal stand-ins for the Supabase-managed `auth` and `storage` schemas so migrations run on plain Postgres (PGlite).
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}', created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb not null default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant select on auth.users to service_role;
`;

export type Db = PGlite;

export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(readFileSync(join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  // Migrations seed the two real source rows; tests start from an empty catalog configuration.
  await db.exec("delete from public.job_sources");
  return db;
}

export async function createUser(db: Db, email: string, opts: { verified?: boolean; termsVersion?: string } = {}): Promise<string> {
  const meta = opts.termsVersion ? { terms_version: opts.termsVersion } : {};
  const r = await db.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id",
    [email, opts.verified === false ? null : new Date().toISOString(), JSON.stringify(meta)],
  );
  return r.rows[0].id;
}

type Role = "authenticated" | "anon" | "service_role" | "discovery_ingest";

/** Run `fn` with the session identity a Supabase client would have (role + JWT sub). */
export async function as<T>(db: Db, who: { uid?: string | null; role?: Role }, fn: () => Promise<T>): Promise<T> {
  const role = who.role ?? (who.uid ? "authenticated" : "anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [who.uid ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

export async function grantAdmin(db: Db, uid: string) {
  await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [uid]);
}

export async function rejects(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected promise to reject");
}
