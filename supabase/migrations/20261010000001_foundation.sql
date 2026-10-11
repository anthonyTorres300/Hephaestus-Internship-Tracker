-- Foundation: account state, roles, audit, quotas, rate limits, policy acceptance.
-- Conventions: text + CHECK constraints mirror Zod validation; every private row carries user_id -> auth.users
-- (ON DELETE CASCADE so deleting the Auth identity removes private rows); timestamps are UTC timestamptz.

create schema if not exists app_private;
revoke all on schema app_private from public;

-- Shared trigger helpers ---------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.block_update() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'rows in % are append-only', tg_table_name using errcode = '42501';
end $$;

-- Account state ------------------------------------------------------------
create table public.account_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state text not null default 'active' check (state in ('active', 'suspended', 'deletion_requested')),
  reason_code text check (reason_code is null or char_length(reason_code) <= 64),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (user_id, role)
);

-- Eligibility check used by every RLS policy: authenticated, verified email, active account.
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from auth.users u
    join public.account_states s on s.user_id = u.id
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and s.state = 'active'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.is_active_user() and exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'
  );
$$;

-- Profiles -----------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  university text check (university is null or char_length(university) <= 200),
  degree text check (degree in ('associate', 'bachelors', 'masters', 'phd', 'other')),
  graduation_year smallint check (graduation_year between 1990 and 2100),
  graduation_month smallint check (graduation_month between 1 and 12),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  timezone_confirmed boolean not null default false,
  work_authorization_country text check (work_authorization_country is null or char_length(work_authorization_country) = 2),
  work_authorized boolean,
  requires_sponsorship boolean,
  citizenship_countries text[] not null default '{}',
  citizenship_known boolean not null default false,
  us_person boolean,
  clearance_eligible boolean,
  preferred_countries text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  willing_to_relocate boolean,
  remote_preference text check (remote_preference in ('remote_only', 'hybrid_ok', 'onsite_ok', 'any')),
  confirmed_skills text[] not null default '{}',
  starred_companies text[] not null default '{}',
  weekly_practice_goal smallint not null default 5 check (weekly_practice_goal between 0 and 100),
  target_season text not null default 'summer' check (target_season in ('summer', 'fall', 'winter', 'spring')),
  target_year smallint not null default 2027 check (target_year between 2020 and 2100),
  preferred_language text not null default 'Python' check (char_length(preferred_language) <= 40),
  onboarding_state text not null default 'not_started' check (onboarding_state in ('not_started', 'in_progress', 'complete')),
  profile_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(confirmed_skills) <= 100),
  check (cardinality(preferred_locations) <= 50),
  check (cardinality(preferred_categories) <= 30)
);

create or replace function public.bump_profile_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  new.profile_revision := old.profile_revision + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_bump before update on public.profiles
  for each row execute function public.bump_profile_revision();

-- Audit --------------------------------------------------------------------
create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (char_length(action) <= 80),
  target_type text not null check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 80),
  metadata jsonb not null default '{}' check (pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);
create trigger admin_audit_no_update before update on public.admin_audit_events
  for each row execute function public.block_update();

create or replace function app_private.audit(p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_events (actor_id, action, target_type, target_id, metadata)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

-- Quotas / rate limits ------------------------------------------------------
create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  quota_type text not null check (char_length(quota_type) <= 40),
  window_start timestamptz not null,
  committed bigint not null default 0 check (committed >= 0),
  reserved bigint not null default 0 check (reserved >= 0),
  reservation_expires_at timestamptz,
  primary key (user_id, quota_type, window_start)
);

create table public.rate_limits (
  bucket text not null check (char_length(bucket) <= 128),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- Durable shared rate limiter. Returns true when the hit is allowed.
create or replace function app_private.rate_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits (bucket, window_start, hits) values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end $$;

-- Authenticated users: bucket is namespaced by their own id so they cannot burn another user's bucket.
create or replace function public.rate_limit_user(p_scope text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_limit < 1 or p_window_seconds < 1 or char_length(p_scope) > 40 then raise exception 'invalid arguments'; end if;
  return app_private.rate_hit('u:' || (select auth.uid())::text || ':' || p_scope, p_limit, p_window_seconds);
end $$;

-- Pre-auth buckets (signup/resend/recovery). Key must be a hash computed by the server, never a raw email/IP.
create or replace function public.rate_limit_public(p_scope text, p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_scope not in ('signup', 'resend', 'recovery', 'login') or char_length(p_key_hash) not between 16 and 128 then
    raise exception 'invalid arguments';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid arguments'; end if;
  return app_private.rate_hit('p:' || p_scope || ':' || p_key_hash, p_limit, p_window_seconds);
end $$;

-- Deletion requests / policy acceptance --------------------------------------
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'in_progress', 'storage_cleaned', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  checkpoints jsonb not null default '{}',
  retry_count integer not null default 0,
  error_code text check (error_code is null or char_length(error_code) <= 64),
  updated_at timestamptz not null default now()
);

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_type text not null check (policy_type in ('terms', 'privacy')),
  version text not null check (char_length(version) <= 32),
  accepted_at timestamptz not null default now(),
  unique (user_id, policy_type, version)
);
create trigger policy_acceptances_no_update before update on public.policy_acceptances
  for each row execute function public.block_update();

-- Account bootstrap: idempotent, trusted. Runs from an auth.users trigger and can be retried by ensure_account().
create or replace function app_private.bootstrap_user(p_user_id uuid, p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (p_user_id) on conflict do nothing;
  insert into public.account_states (user_id, state) values (p_user_id, 'active') on conflict do nothing;
  if p_terms_version is not null and char_length(p_terms_version) <= 32 then
    insert into public.policy_acceptances (user_id, policy_type, version) values (p_user_id, 'terms', p_terms_version)
    on conflict do nothing;
  end if;
end $$;

create or replace function app_private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app_private.bootstrap_user(new.id, new.raw_user_meta_data ->> 'terms_version');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.on_auth_user_created();

create or replace function public.ensure_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform app_private.bootstrap_user(uid, null);
  return jsonb_build_object('user_id', uid, 'state', (select state from public.account_states where user_id = uid));
end $$;
