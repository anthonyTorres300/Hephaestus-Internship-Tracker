-- Row Level Security, grants and trusted triggers.
-- Default-deny: strip every default privilege, then grant exactly what each role needs.

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.account_states enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.usage_counters enable row level security;
alter table public.rate_limits enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.policy_acceptances enable row level security;
alter table public.job_sources enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.source_runs enable row level security;
alter table public.jobs enable row level security;
alter table public.job_observations enable row level security;
alter table public.job_observation_events enable row level security;
alter table public.job_merge_candidates enable row level security;
alter table public.job_merge_events enable row level security;
alter table public.catalog_verifications enable row level security;
alter table public.dsa_topics enable row level security;
alter table public.operation_keys enable row level security;
alter table public.resume_versions enable row level security;
alter table public.resume_defaults enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_events enable row level security;
alter table public.application_notes enable row level security;
alter table public.interview_events enable row level security;
alter table public.offer_events enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.user_jobs enable row level security;
alter table public.practice_problems enable row level security;
alter table public.problem_topics enable row level security;
alter table public.practice_attempts enable row level security;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_active_user(), public.is_admin() to authenticated;

-- ---- Shared catalog: read for active verified users; admin-only operational tables ----
grant select on public.jobs, public.job_observations, public.dsa_topics, public.catalog_verifications to authenticated;
grant select on public.job_sources, public.discovery_runs, public.source_runs, public.job_observation_events,
  public.job_merge_candidates, public.job_merge_events, public.admin_audit_events to authenticated;

create policy jobs_read on public.jobs for select to authenticated using (public.is_active_user());
create policy observations_read on public.job_observations for select to authenticated using (public.is_active_user());
create policy topics_read on public.dsa_topics for select to authenticated using (public.is_active_user());
create policy cat_verif_read on public.catalog_verifications for select to authenticated using (public.is_active_user());
create policy sources_admin on public.job_sources for select to authenticated using (public.is_admin());
create policy runs_admin on public.discovery_runs for select to authenticated using (public.is_admin());
create policy source_runs_admin on public.source_runs for select to authenticated using (public.is_admin());
create policy obs_events_admin on public.job_observation_events for select to authenticated using (public.is_admin());
create policy merge_cand_admin on public.job_merge_candidates for select to authenticated using (public.is_admin());
create policy merge_events_admin on public.job_merge_events for select to authenticated using (public.is_admin());
create policy audit_admin on public.admin_audit_events for select to authenticated using (public.is_admin());

-- Sanitized feed health: no diagnostics, only last success + stale flag.
create or replace view public.feed_health as
select s.id as source_id, s.repo_owner || '/' || s.repo_name as repository, s.attribution, s.license,
       s.last_success_at, (s.last_success_at is null or s.last_success_at < now() - interval '48 hours') as stale
from public.job_sources s
where s.enabled and public.is_active_user();
grant select on public.feed_health to authenticated;

-- ---- Private account tables ----
grant select on public.account_states, public.usage_counters, public.account_deletion_requests, public.policy_acceptances to authenticated;
create policy account_states_own on public.account_states for select to authenticated using (user_id = (select auth.uid()));
create policy usage_own on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));
create policy deletion_own on public.account_deletion_requests for select to authenticated using (user_id = (select auth.uid()));
create policy policy_acc_own on public.policy_acceptances for select to authenticated using (user_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (university, degree, graduation_year, graduation_month, timezone, timezone_confirmed, work_authorization_country,
  work_authorized, requires_sponsorship, citizenship_countries, citizenship_known, us_person, clearance_eligible,
  preferred_countries, preferred_locations, preferred_categories, willing_to_relocate, remote_preference, confirmed_skills,
  starred_companies, weekly_practice_goal, target_season, target_year, preferred_language, onboarding_state)
  on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));

-- ---- Applications: reads + column-limited updates; creation/status only through RPCs ----
grant select, delete on public.applications to authenticated;
grant update (company_name, role_title, requisition_id, application_url, portal_url, locations, work_mode, role_category,
  season, season_year, priority, submitted_year, submitted_month, submitted_day, submitted_precision, submission_date_unknown,
  contact_channel, confirmed_identity, resume_version_id, archived_at, trashed_at)
  on public.applications to authenticated;
create policy apps_select on public.applications for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy apps_update on public.applications for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));
-- Permanent deletion is allowed only after the record is in trash.
create policy apps_delete on public.applications for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user() and trashed_at is not null);

grant select on public.application_status_events, public.task_events, public.offer_events to authenticated;
create policy status_events_own on public.application_status_events for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy task_events_own on public.task_events for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy offer_events_own on public.offer_events for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());

-- Standard owned child tables
do $$
declare t text;
begin
  foreach t in array array['application_notes', 'interview_events', 'tasks', 'user_jobs', 'practice_problems', 'practice_attempts']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %1$s_sel on public.%1$I for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user())', t);
    execute format('create policy %1$s_ins on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user())', t);
    execute format('create policy %1$s_upd on public.%1$I for update to authenticated using (user_id = (select auth.uid()) and public.is_active_user()) with check (user_id = (select auth.uid()) and public.is_active_user())', t);
    execute format('create policy %1$s_del on public.%1$I for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user())', t);
  end loop;
end $$;

-- tasks: state/completion columns are maintained by trigger; clients cannot forge completed_at
revoke update on public.tasks from authenticated;
grant update (kind, due_date, due_at, timezone, state, evidence, note) on public.tasks to authenticated;
revoke update on public.user_jobs from authenticated;
grant update (saved, hidden, verification_state, verification_url, verification_note, verified_at) on public.user_jobs to authenticated;

-- Offers recorded manually (status RPC also writes offer evidence)
grant insert, update, delete on public.offer_events to authenticated;
create policy offer_events_ins on public.offer_events for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user());
create policy offer_events_upd on public.offer_events for update to authenticated using (user_id = (select auth.uid()) and public.is_active_user()) with check (user_id = (select auth.uid()));
create policy offer_events_del on public.offer_events for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user());

grant select, insert, delete on public.problem_topics to authenticated;
create policy problem_topics_sel on public.problem_topics for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy problem_topics_ins on public.problem_topics for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user());
create policy problem_topics_del on public.problem_topics for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user());

-- Resumes / defaults: read only; writes through RPCs
grant select on public.resume_versions, public.resume_defaults to authenticated;
create policy resumes_own on public.resume_versions for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy resume_defaults_own on public.resume_defaults for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());

-- Import staging
grant select, insert, update on public.import_batches to authenticated;
create policy batches_sel on public.import_batches for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy batches_ins on public.import_batches for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user() and state = 'staged');
create policy batches_upd on public.import_batches for update to authenticated using (user_id = (select auth.uid()) and public.is_active_user() and state = 'staged') with check (user_id = (select auth.uid()));
revoke update on public.import_batches from authenticated;
grant update (state) on public.import_batches to authenticated;

grant select, insert, update, delete on public.import_rows to authenticated;
create policy rows_sel on public.import_rows for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy rows_ins on public.import_rows for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user() and outcome is null and application_id is null);
create policy rows_upd on public.import_rows for update to authenticated using (user_id = (select auth.uid()) and public.is_active_user() and outcome is null) with check (user_id = (select auth.uid()));
create policy rows_del on public.import_rows for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user() and outcome is null);
revoke update on public.import_rows from authenticated;
grant update (proposed, decision, linked_application_id) on public.import_rows to authenticated;
alter table public.import_rows add constraint import_rows_ordinal_cap check (ordinal between 1 and 5000);

-- ---- Trusted triggers ----
-- Per-account row caps with a per-user advisory lock so concurrent inserts cannot exceed the limit.
create or replace function app_private.cap_rows() returns trigger
language plpgsql security definer set search_path = public as $$
declare n bigint; lim bigint := tg_argv[0]::bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || new.user_id::text, 0));
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= lim then
    raise exception 'quota_exceeded: % limit of % reached', tg_table_name, lim using errcode = 'PT429';
  end if;
  return new;
end $$;
create trigger cap_attempts before insert on public.practice_attempts for each row execute function app_private.cap_rows('10000');
create trigger cap_problems before insert on public.practice_problems for each row execute function app_private.cap_rows('5000');
create trigger cap_notes before insert on public.application_notes for each row execute function app_private.cap_rows('20000');
create trigger cap_tasks before insert on public.tasks for each row execute function app_private.cap_rows('5000');
create trigger cap_interviews before insert on public.interview_events for each row execute function app_private.cap_rows('5000');
create trigger cap_user_jobs before insert on public.user_jobs for each row execute function app_private.cap_rows('20000');

create or replace function app_private.limit_import_previews() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not app_private.rate_hit('u:' || new.user_id::text || ':import_preview', 5, 3600) then
    raise exception 'rate_limited: import previews' using errcode = 'PT429';
  end if;
  return new;
end $$;
create trigger limit_import_previews before insert on public.import_batches for each row execute function app_private.limit_import_previews();

-- Task completion bookkeeping and audit trail (clients cannot skip it)
create or replace function app_private.task_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.state = 'completed' and old.state <> 'completed' then new.completed_at := now();
    elsif new.state <> 'completed' then new.completed_at := null;
    else new.completed_at := old.completed_at; end if;
  elsif new.state = 'completed' then new.completed_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
create trigger tasks_before before insert or update on public.tasks for each row execute function app_private.task_before_write();

create or replace function app_private.task_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (user_id, task_id, action, new_due_date, new_due_at, new_state)
    values (new.user_id, new.id, 'created', new.due_date, new.due_at, new.state);
  elsif new.state is distinct from old.state or new.due_date is distinct from old.due_date or new.due_at is distinct from old.due_at then
    act := case
      when new.state is distinct from old.state and new.state = 'completed' then 'completed'
      when new.state is distinct from old.state and new.state = 'dismissed' then 'dismissed'
      when new.state is distinct from old.state then 'reopened'
      else 'snoozed' end;
    insert into public.task_events (user_id, task_id, action, old_due_date, old_due_at, new_due_date, new_due_at, old_state, new_state)
    values (new.user_id, new.id, act, old.due_date, old.due_at, new.due_date, new.due_at, old.state, new.state);
  end if;
  return new;
end $$;
create trigger tasks_audit after insert or update on public.tasks for each row execute function app_private.task_audit();

-- Hidden jobs keep their timestamp
create or replace function app_private.user_job_hidden_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.hidden and (tg_op = 'INSERT' or not old.hidden) then new.hidden_at := now();
  elsif not new.hidden then new.hidden_at := null; end if;
  return new;
end $$;
create trigger user_jobs_hidden before insert or update on public.user_jobs for each row execute function app_private.user_job_hidden_at();

-- Taxonomy seed (global, read-only for clients)
insert into public.dsa_topics (slug, title, sort_order) values
  ('arrays-hash-maps', 'Arrays / Hash Maps', 1), ('two-pointers', 'Two Pointers', 2), ('sliding-window', 'Sliding Window', 3),
  ('stacks-queues', 'Stacks / Queues', 4), ('binary-search', 'Binary Search', 5), ('linked-lists', 'Linked Lists', 6),
  ('trees-bst', 'Trees / BST', 7), ('heaps', 'Heaps', 8), ('graphs', 'Graphs', 9),
  ('recursion-backtracking', 'Recursion / Backtracking', 10), ('dynamic-programming', 'Dynamic Programming', 11),
  ('greedy', 'Greedy', 12), ('intervals', 'Intervals', 13), ('bit-manipulation', 'Bit Manipulation', 14), ('math', 'Math', 15);
