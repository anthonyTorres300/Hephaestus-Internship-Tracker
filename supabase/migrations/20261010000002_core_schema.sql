-- Core schema: shared job catalog (global) and private workspace tables (per user).

-- =========================== SHARED CATALOG ===========================
create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  repo_owner text not null,
  repo_name text not null,
  path text not null,
  adapter_id text not null,
  adapter_version text not null,
  default_branch text,
  enabled boolean not null default true,
  license text,
  attribution text,
  last_success_at timestamptz,
  last_commit_sha text,
  etag text,
  accepted_row_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repo_owner, repo_name, path, adapter_id)
);
create trigger job_sources_touch before update on public.job_sources
  for each row execute function public.touch_updated_at();

create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('schedule', 'manual')),
  correlation_id uuid,
  state text not null default 'running' check (state in ('running', 'success', 'partial', 'failed', 'held_for_review')),
  runner_id text check (char_length(runner_id) <= 80),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lease_expires_at timestamptz not null,
  counts jsonb not null default '{}' check (pg_column_size(counts) <= 8192),
  error_code text check (error_code is null or char_length(error_code) <= 64)
);
create unique index discovery_runs_one_running on public.discovery_runs ((true)) where state = 'running';

create table public.source_runs (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.discovery_runs (id) on delete cascade,
  source_id uuid not null references public.job_sources (id) on delete cascade,
  state text not null check (state in ('success', 'failed', 'held_for_review', 'not_modified', 'approved')),
  commit_sha text,
  payload_hash text,
  complete boolean not null default false,
  row_count integer not null default 0,
  quarantined_count integer not null default 0,
  baseline_row_count integer not null default 0,
  diagnostics jsonb not null default '{}' check (pg_column_size(diagnostics) <= 8192),
  held_payload jsonb,
  created_at timestamptz not null default now()
);
create index source_runs_source_idx on public.source_runs (source_id, created_at desc);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 200),
  title text not null check (char_length(title) between 1 and 300),
  role_category text,
  season text check (season in ('summer', 'fall', 'winter', 'spring')),
  season_year smallint,
  locations jsonb not null default '[]',
  country text,
  work_mode text check (work_mode in ('onsite', 'hybrid', 'remote', 'unknown')),
  apply_url text,
  canonical_url text,
  identity_key text unique,
  candidate_key text,
  ats_namespace text,
  employer_namespace text,
  requisition_id text,
  normalization_version text not null default '1',
  requirements jsonb not null default '{}' check (pg_column_size(requirements) <= 8192),
  source_posted_year smallint,
  source_posted_month smallint,
  source_posted_day smallint,
  source_posted_precision text not null default 'unknown' check (source_posted_precision in ('day', 'month', 'year', 'unknown')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  availability text not null default 'listed'
    check (availability in ('listed', 'source_closed', 'missing_from_source', 'unknown')),
  superseded_by uuid references public.jobs (id),
  merged_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_canonical_url_idx on public.jobs (canonical_url) where canonical_url is not null;
create index jobs_candidate_key_idx on public.jobs (candidate_key) where candidate_key is not null;
create index jobs_first_seen_idx on public.jobs (first_seen_at desc) where superseded_by is null;
create index jobs_season_idx on public.jobs (season_year, season) where superseded_by is null;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

create table public.job_observations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  source_id uuid not null references public.job_sources (id) on delete cascade,
  source_run_id uuid references public.source_runs (id) on delete set null,
  entry_key text not null,
  permalink text,
  row_hash text not null,
  snapshot jsonb not null check (pg_column_size(snapshot) <= 8192),
  state text not null default 'listed' check (state in ('listed', 'source_closed', 'missing_from_source')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  missing_count integer not null default 0,
  first_missing_at timestamptz,
  unique (source_id, entry_key)
);
create index job_observations_source_seen_idx on public.job_observations (source_id, last_seen_at);
create index job_observations_job_idx on public.job_observations (job_id);

create table public.job_observation_events (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.job_observations (id) on delete cascade,
  source_run_id uuid references public.source_runs (id) on delete set null,
  event_type text not null check (event_type in ('first_seen', 'changed', 'closed', 'reopened', 'missing')),
  snapshot jsonb not null check (pg_column_size(snapshot) <= 8192),
  observed_at timestamptz not null default now()
);
create index job_observation_events_obs_idx on public.job_observation_events (observation_id, observed_at);
create trigger job_observation_events_no_update before update on public.job_observation_events
  for each row execute function public.block_update();

create table public.job_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  job_a uuid not null references public.jobs (id) on delete cascade,
  job_b uuid not null references public.jobs (id) on delete cascade,
  reason text not null,
  state text not null default 'open' check (state in ('open', 'merged', 'dismissed')),
  created_at timestamptz not null default now(),
  check (job_a < job_b),
  unique (job_a, job_b)
);

create table public.job_merge_events (
  id uuid primary key default gen_random_uuid(),
  kept_job_id uuid not null references public.jobs (id),
  merged_job_id uuid not null references public.jobs (id),
  admin_id uuid,
  moved_observations integer not null default 0,
  remapped_user_jobs integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.catalog_verifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  admin_id uuid,
  evidence_url text not null check (evidence_url ~ '^https://'),
  evidence_note text check (char_length(evidence_note) <= 1000),
  state text not null check (state in ('open', 'closed')),
  verified_at timestamptz not null default now()
);
create index catalog_verifications_job_idx on public.catalog_verifications (job_id, verified_at desc);

create table public.dsa_topics (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  sort_order smallint not null default 0
);

-- =========================== PRIVATE WORKSPACE ===========================
create table public.operation_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (char_length(scope) <= 40),
  key text not null check (char_length(key) between 8 and 128),
  request_hash text,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, scope, key)
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null,
  label text not null check (char_length(label) between 1 and 120),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) <= 255),
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  source_link text check (source_link is null or source_link ~ '^https://'),
  source_date date,
  role_tags text[] not null default '{}',
  notes text check (char_length(notes) <= 2000),
  state text not null default 'pending_upload' check (state in ('pending_upload', 'ready', 'delete_pending', 'failed')),
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, version_number)
);
create index resume_versions_user_idx on public.resume_versions (user_id, state);
create index resume_versions_sha_idx on public.resume_versions (user_id, sha256);

create table public.resume_defaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  resume_id uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (resume_id, user_id) references public.resume_versions (id, user_id) on delete restrict
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text check (char_length(file_name) <= 255),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  mapping_version text not null default '1',
  review_round integer not null default 1,
  state text not null default 'staged' check (state in ('staged', 'committed', 'cancelled', 'undone')),
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique (id, user_id),
  unique (user_id, file_hash, mapping_version, review_round)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  company_name text not null check (char_length(company_name) between 1 and 200),
  role_title text not null check (char_length(role_title) between 1 and 300),
  requisition_id text check (char_length(requisition_id) <= 100),
  application_url text check (application_url is null or application_url ~ '^https?://'),
  portal_url text check (portal_url is null or portal_url ~ '^https?://'),
  locations jsonb not null default '[]',
  work_mode text check (work_mode in ('onsite', 'hybrid', 'remote', 'unknown')),
  role_category text check (char_length(role_category) <= 60),
  season text check (season in ('summer', 'fall', 'winter', 'spring')),
  season_year smallint check (season_year between 2000 and 2100),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null check (status in ('saved', 'prepared', 'applied', 'screening', 'assessment', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted')),
  submitted_year smallint,
  submitted_month smallint,
  submitted_day smallint,
  submitted_precision text not null default 'unknown' check (submitted_precision in ('day', 'month', 'year', 'unknown')),
  submission_date_unknown boolean not null default false,
  submission_attested boolean not null default false,
  original_status text check (char_length(original_status) <= 120),
  original_application_date text check (char_length(original_application_date) <= 120),
  contact_channel text check (char_length(contact_channel) <= 300),
  confirmed_identity text check (char_length(confirmed_identity) <= 200),
  resume_version_id uuid,
  import_batch_id uuid,
  archived_at timestamptz,
  trashed_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (resume_version_id, user_id) references public.resume_versions (id, user_id) on delete restrict,
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete set null (import_batch_id),
  -- partial-date convention: parts present exactly as precision demands, and the calendar date is valid
  constraint applications_submitted_date_parts check (
    (submitted_precision = 'unknown' and submitted_year is null and submitted_month is null and submitted_day is null)
    or (submitted_precision = 'year' and submitted_year is not null and submitted_month is null and submitted_day is null)
    or (submitted_precision = 'month' and submitted_year is not null and submitted_month between 1 and 12 and submitted_day is null)
    or (submitted_precision = 'day' and submitted_year is not null and submitted_month between 1 and 12 and submitted_day between 1 and 31
        and make_date(submitted_year, submitted_month, 1) + (submitted_day - 1) < (make_date(submitted_year, submitted_month, 1) + interval '1 month')::date)
  ),
  -- saved/prepared carry no submission facts; submitted stages need a date or the explicit unknown flag + attestation
  constraint applications_submission_rules check (
    (status in ('saved', 'prepared') and submitted_precision = 'unknown' and not submission_date_unknown and not submission_attested)
    or (status not in ('saved', 'prepared') and submission_attested and (submitted_precision <> 'unknown' or submission_date_unknown))
  )
);
create index applications_season_status_idx on public.applications (user_id, season_year, status);
create index applications_submitted_idx on public.applications (user_id, submitted_year, submitted_month);
create index applications_job_idx on public.applications (user_id, job_id) where job_id is not null;
create index applications_search_idx on public.applications (user_id, lower(company_name), lower(role_title));
create index applications_import_idx on public.applications (import_batch_id) where import_batch_id is not null;

create or replace function public.bump_application_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger applications_bump before update on public.applications
  for each row execute function public.bump_application_revision();

create table public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  old_status text,
  new_status text not null,
  effective_at timestamptz,
  effective_at_unknown boolean not null default false,
  recorded_at timestamptz not null default now(),
  origin text not null check (origin in ('manual', 'job', 'import', 'reopen', 'correction')),
  reason text check (char_length(reason) <= 500),
  idempotency_key text check (char_length(idempotency_key) <= 128),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  unique (application_id, idempotency_key)
);
create index application_status_events_idx on public.application_status_events (application_id, recorded_at);
create trigger status_events_no_update before update on public.application_status_events
  for each row execute function public.block_update();

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index application_notes_idx on public.application_notes (application_id, created_at);
create trigger notes_touch before update on public.application_notes for each row execute function public.touch_updated_at();

create table public.interview_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  round_number smallint not null default 1 check (round_number between 1 and 20),
  round_type text check (round_type in ('recruiter', 'technical', 'behavioral', 'onsite', 'final', 'other')),
  scheduled_at timestamptz,
  event_year smallint,
  event_month smallint,
  event_day smallint,
  date_precision text not null default 'unknown' check (date_precision in ('day', 'month', 'year', 'unknown', 'timestamp')),
  timezone text check (char_length(timezone) <= 64),
  outcome text not null default 'pending' check (outcome in ('pending', 'passed', 'failed', 'cancelled', 'unknown')),
  notes text check (char_length(notes) <= 5000),
  raw_value text check (char_length(raw_value) <= 200),
  origin text not null default 'manual' check (origin in ('manual', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  check ((date_precision = 'timestamp') = (scheduled_at is not null))
);
create index interview_events_idx on public.interview_events (application_id, round_number);
create trigger interviews_touch before update on public.interview_events for each row execute function public.touch_updated_at();

create table public.offer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  received_year smallint,
  received_month smallint,
  received_day smallint,
  date_precision text not null default 'unknown' check (date_precision in ('day', 'month', 'year', 'unknown')),
  date_unknown boolean not null default false,
  raw_value text check (char_length(raw_value) <= 200),
  needs_review boolean not null default false,
  origin text not null default 'manual' check (origin in ('manual', 'import', 'status')),
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index offer_events_idx on public.offer_events (application_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  job_id uuid references public.jobs (id) on delete set null,
  kind text not null check (kind in ('application_deadline', 'follow_up', 'offer_deadline', 'review')),
  due_date date,
  due_at timestamptz,
  timezone text check (char_length(timezone) <= 64),
  state text not null default 'pending' check (state in ('pending', 'completed', 'dismissed')),
  source text not null default 'user' check (source in ('user', 'source_claim')),
  evidence text check (char_length(evidence) <= 500),
  note text check (char_length(note) <= 2000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  check ((due_date is null) <> (due_at is null))
);
create index tasks_state_date_idx on public.tasks (user_id, state, due_date);
create index tasks_state_due_at_idx on public.tasks (user_id, state, due_at);
create index tasks_app_idx on public.tasks (application_id) where application_id is not null;

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  action text not null check (action in ('created', 'completed', 'dismissed', 'reopened', 'snoozed', 'edited')),
  old_due_date date,
  old_due_at timestamptz,
  new_due_date date,
  new_due_at timestamptz,
  old_state text,
  new_state text,
  recorded_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index task_events_idx on public.task_events (task_id, recorded_at);
create trigger task_events_no_update before update on public.task_events
  for each row execute function public.block_update();

create table public.user_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  saved boolean not null default false,
  hidden boolean not null default false,
  hidden_at timestamptz,
  verification_state text not null default 'none' check (verification_state in ('none', 'open', 'closed')),
  verification_url text check (verification_url is null or verification_url ~ '^https://'),
  verification_note text check (char_length(verification_note) <= 1000),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id),
  unique (id, user_id)
);
create trigger user_jobs_touch before update on public.user_jobs for each row execute function public.touch_updated_at();

create table public.practice_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'leetcode' check (platform in ('leetcode')),
  platform_id text check (char_length(platform_id) <= 20),
  slug text check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 120),
  url text check (url is null or url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 200),
  difficulty text not null default 'unknown' check (difficulty in ('easy', 'medium', 'hard', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index practice_problems_slug_uq on public.practice_problems (user_id, platform, slug) where slug is not null;
create trigger problems_touch before update on public.practice_problems for each row execute function public.touch_updated_at();

create table public.problem_topics (
  problem_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id smallint not null references public.dsa_topics (id),
  primary key (problem_id, topic_id),
  foreign key (problem_id, user_id) references public.practice_problems (id, user_id) on delete cascade
);
create index problem_topics_user_idx on public.problem_topics (user_id, topic_id);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id uuid not null,
  practiced_at timestamptz not null default now(),
  duration_minutes smallint check (duration_minutes between 0 and 240),
  duration_unknown boolean not null default false,
  language text check (char_length(language) <= 40),
  result text not null check (result in ('solved_independently', 'solved_with_hints', 'reviewed_solution', 'unsolved')),
  confidence smallint check (confidence between 1 and 5),
  notes text check (char_length(notes) <= 5000),
  next_review_date date,
  created_at timestamptz not null default now(),
  foreign key (problem_id, user_id) references public.practice_problems (id, user_id) on delete cascade,
  check (not (duration_unknown and duration_minutes is not null))
);
create index practice_attempts_idx on public.practice_attempts (user_id, practiced_at);
create index practice_attempts_problem_idx on public.practice_attempts (problem_id);
create index practice_attempts_review_idx on public.practice_attempts (user_id, next_review_date) where next_review_date is not null;

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  batch_id uuid not null,
  ordinal integer not null,
  raw_values jsonb not null check (pg_column_size(raw_values) <= 16384),
  proposed jsonb not null default '{}' check (pg_column_size(proposed) <= 16384),
  row_fingerprint text not null,
  warnings jsonb not null default '[]',
  errors jsonb not null default '[]',
  decision text not null default 'pending' check (decision in ('pending', 'accept', 'skip', 'linked')),
  outcome text check (outcome in ('created', 'linked', 'skipped', 'failed')),
  application_id uuid,
  linked_application_id uuid,
  foreign key (batch_id, user_id) references public.import_batches (id, user_id) on delete cascade,
  unique (batch_id, ordinal)
);
create index import_rows_batch_idx on public.import_rows (batch_id);
create index import_rows_fingerprint_idx on public.import_rows (user_id, row_fingerprint);

-- Dedupes shared catalog reads for views
create or replace view public.job_availability_overlay as
select j.id as job_id,
       (select cv.state from public.catalog_verifications cv where cv.job_id = j.id order by cv.verified_at desc limit 1) as verified_state,
       (select cv.verified_at from public.catalog_verifications cv where cv.job_id = j.id order by cv.verified_at desc limit 1) as verified_at
from public.jobs j
where public.is_active_user();
