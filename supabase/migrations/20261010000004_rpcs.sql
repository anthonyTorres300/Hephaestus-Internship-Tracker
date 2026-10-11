-- Atomic operations. All are SECURITY DEFINER with a fixed search_path, explicit identity checks and narrow grants.
-- Error codes follow PostgREST's PTxyz convention so they surface as HTTP statuses (403/404/409/422/429).

create or replace function app_private.require_active() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or not public.is_active_user() then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;
  return uid;
end $$;

create or replace function app_private.submitted_status(s text) returns boolean
language sql immutable as $$ select s not in ('saved', 'prepared') $$;

-- ---------------------------------------------------------------- applications
create or replace function app_private.insert_application(p_uid uuid, p jsonb, p_origin text)
returns public.applications language plpgsql security definer set search_path = public as $$
declare
  a public.applications;
  st text := coalesce(p ->> 'status', 'prepared');
  sub boolean := app_private.submitted_status(coalesce(p ->> 'status', 'prepared'));
  prec text := case when app_private.submitted_status(st) then coalesce(p ->> 'submitted_precision', 'unknown') else 'unknown' end;
  unk boolean := app_private.submitted_status(st) and coalesce((p ->> 'submission_date_unknown')::boolean, false);
  eff timestamptz := (p ->> 'effective_at')::timestamptz;
begin
  if st not in ('saved','prepared','applied','screening','assessment','interview','offer','accepted','rejected','withdrawn','ghosted') then
    raise exception 'invalid status' using errcode = 'PT422';
  end if;
  if sub and not coalesce((p ->> 'attested')::boolean, false) then
    raise exception 'attestation_required' using errcode = 'PT422';
  end if;
  if sub and prec = 'unknown' and not unk then
    raise exception 'submission_date_required' using errcode = 'PT422';
  end if;
  if sub and unk then prec := 'unknown'; end if;

  insert into public.applications (
    user_id, job_id, company_name, role_title, requisition_id, application_url, portal_url, locations, work_mode,
    role_category, season, season_year, priority, status, submitted_year, submitted_month, submitted_day, submitted_precision,
    submission_date_unknown, submission_attested, original_status, original_application_date, contact_channel,
    confirmed_identity, resume_version_id, import_batch_id)
  values (
    p_uid, nullif(p ->> 'job_id', '')::uuid, p ->> 'company_name', p ->> 'role_title', nullif(p ->> 'requisition_id', ''),
    nullif(p ->> 'application_url', ''), nullif(p ->> 'portal_url', ''), coalesce(p -> 'locations', '[]'::jsonb),
    nullif(p ->> 'work_mode', ''), nullif(p ->> 'role_category', ''), nullif(p ->> 'season', ''), nullif(p ->> 'season_year', '')::smallint,
    coalesce(p ->> 'priority', 'medium'), st,
    case when prec <> 'unknown' then (p ->> 'submitted_year')::smallint end,
    case when prec in ('month', 'day') then (p ->> 'submitted_month')::smallint end,
    case when prec = 'day' then (p ->> 'submitted_day')::smallint end,
    prec, unk, sub, nullif(p ->> 'original_status', ''), nullif(p ->> 'original_application_date', ''),
    nullif(p ->> 'contact_channel', ''), nullif(p ->> 'confirmed_identity', ''), nullif(p ->> 'resume_version_id', '')::uuid,
    nullif(p ->> 'import_batch_id', '')::uuid)
  returning * into a;

  insert into public.application_status_events (user_id, application_id, old_status, new_status, effective_at, effective_at_unknown, origin, reason, idempotency_key)
  values (p_uid, a.id, null, st,
          case when p_origin = 'import' then null else coalesce(eff, now()) end,
          p_origin = 'import', p_origin, case when p_origin = 'import' then 'imported snapshot' end, 'create');

  if (p ? 'offer') or st in ('offer', 'accepted') then
    insert into public.offer_events (user_id, application_id, received_year, received_month, received_day, date_precision, date_unknown, raw_value, needs_review, origin)
    values (p_uid, a.id,
      (p -> 'offer' ->> 'year')::smallint, (p -> 'offer' ->> 'month')::smallint, (p -> 'offer' ->> 'day')::smallint,
      coalesce(p -> 'offer' ->> 'precision', 'unknown'),
      coalesce((p -> 'offer' ->> 'precision'), 'unknown') = 'unknown',
      p -> 'offer' ->> 'raw', coalesce((p -> 'offer' ->> 'needs_review')::boolean, false),
      case when p_origin = 'import' then 'import' else 'status' end);
  end if;

  if p ? 'interview' then
    insert into public.interview_events (user_id, application_id, event_year, event_month, event_day, date_precision, raw_value, origin)
    values (p_uid, a.id,
      (p -> 'interview' ->> 'year')::smallint, (p -> 'interview' ->> 'month')::smallint, (p -> 'interview' ->> 'day')::smallint,
      coalesce(p -> 'interview' ->> 'precision', 'unknown'), p -> 'interview' ->> 'raw', 'import');
  end if;
  return a;
end $$;

create or replace function public.create_application(p jsonb, p_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := app_private.require_active();
  existing jsonb; a public.applications; n bigint; h text := md5(p::text);
begin
  if jsonb_typeof(p) <> 'object' or char_length(coalesce(p ->> 'company_name', '')) = 0 or char_length(coalesce(p ->> 'role_title', '')) = 0 then
    raise exception 'company_name and role_title are required' using errcode = 'PT422';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('apps' || uid::text, 0));
  if p_key is not null then
    select result into existing from public.operation_keys where user_id = uid and scope = 'create_application' and key = p_key;
    if found then return existing; end if;
  end if;
  select count(*) into n from public.applications where user_id = uid;
  if n >= 2000 then raise exception 'quota_exceeded: applications' using errcode = 'PT429'; end if;
  if (p ->> 'job_id') is not null and not exists (select 1 from public.jobs where id = (p ->> 'job_id')::uuid) then
    raise exception 'job not found' using errcode = 'PT404';
  end if;
  a := app_private.insert_application(uid, p - 'import_batch_id' - 'offer' - 'interview', coalesce(nullif(p ->> 'origin', ''), 'manual'));
  if p_key is not null then
    insert into public.operation_keys (user_id, scope, key, request_hash, result) values (uid, 'create_application', p_key, h, to_jsonb(a));
  end if;
  return to_jsonb(a);
end $$;

create or replace function public.change_application_status(
  p_application_id uuid, p_expected_revision integer, p_new_status text, p_reason text default null,
  p_effective_at timestamptz default null, p_attested boolean default false, p_submitted jsonb default null,
  p_submission_unknown boolean default false, p_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := app_private.require_active();
  a public.applications; prec text; origin text := 'manual';
begin
  if p_new_status not in ('saved','prepared','applied','screening','assessment','interview','offer','accepted','rejected','withdrawn','ghosted') then
    raise exception 'invalid status' using errcode = 'PT422';
  end if;
  select * into a from public.applications where id = p_application_id and user_id = uid for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if p_key is not null and exists (select 1 from public.application_status_events where application_id = a.id and idempotency_key = p_key) then
    return to_jsonb(a);
  end if;
  if a.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = 'PT409'; end if;
  if a.trashed_at is not null then raise exception 'application is in trash' using errcode = 'PT409'; end if;
  if a.status = p_new_status then return to_jsonb(a); end if;

  if not app_private.submitted_status(p_new_status) then
    if app_private.submitted_status(a.status) then
      raise exception 'cannot move a submitted application back to %', p_new_status using errcode = 'PT422';
    end if;
    update public.applications set status = p_new_status where id = a.id returning * into a;
  else
    if not app_private.submitted_status(a.status) then
      if not p_attested then raise exception 'attestation_required' using errcode = 'PT422'; end if;
      prec := coalesce(p_submitted ->> 'precision', 'unknown');
      if prec = 'unknown' and not p_submission_unknown then raise exception 'submission_date_required' using errcode = 'PT422'; end if;
      update public.applications set
        status = p_new_status, submission_attested = true,
        submission_date_unknown = (prec = 'unknown'),
        submitted_precision = prec,
        submitted_year = case when prec <> 'unknown' then (p_submitted ->> 'year')::smallint end,
        submitted_month = case when prec in ('month', 'day') then (p_submitted ->> 'month')::smallint end,
        submitted_day = case when prec = 'day' then (p_submitted ->> 'day')::smallint end
      where id = a.id returning * into a;
    else
      if a.status in ('rejected', 'withdrawn', 'ghosted') and p_new_status in ('applied','screening','assessment','interview','offer') then
        if p_reason is null or char_length(btrim(p_reason)) = 0 then raise exception 'reason_required' using errcode = 'PT422'; end if;
        origin := 'reopen';
      end if;
      update public.applications set status = p_new_status where id = a.id returning * into a;
    end if;
  end if;

  insert into public.application_status_events (user_id, application_id, old_status, new_status, effective_at, origin, reason, idempotency_key)
  select uid, a.id, e.old_status, p_new_status, coalesce(p_effective_at, now()), origin, nullif(btrim(p_reason), ''), p_key
  from (select (select new_status from public.application_status_events where application_id = a.id order by recorded_at desc, id desc limit 1) as old_status) e;

  if p_new_status in ('offer', 'accepted') and not exists (select 1 from public.offer_events where application_id = a.id) then
    insert into public.offer_events (user_id, application_id, date_precision, date_unknown, origin) values (uid, a.id, 'unknown', true, 'status');
  end if;
  return to_jsonb(a);
end $$;

-- ---------------------------------------------------------------- import
create or replace function public.commit_import_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := app_private.require_active();
  b public.import_batches; r public.import_rows; a public.applications;
  created int := 0; linked int := 0; skipped int := 0; failed int := 0; total int; existing_apps bigint; to_create int;
begin
  select * into b from public.import_batches where id = p_batch_id and user_id = uid for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if b.state = 'committed' then return b.summary; end if;
  if b.state <> 'staged' then raise exception 'batch is %', b.state using errcode = 'PT409'; end if;
  perform pg_advisory_xact_lock(hashtextextended('apps' || uid::text, 0));

  if exists (
    select 1 from public.import_rows ir
    where ir.batch_id = b.id and ir.decision <> 'skip'
      and (jsonb_array_length(ir.errors) > 0
           or (ir.decision = 'pending' and exists (select 1 from jsonb_array_elements(ir.warnings) w where (w ->> 'blocking')::boolean is true)))
  ) then
    raise exception 'unresolved_rows' using errcode = 'PT422';
  end if;

  select count(*) into existing_apps from public.applications where user_id = uid;
  select count(*) into to_create from public.import_rows where batch_id = b.id and decision in ('accept', 'pending');
  if existing_apps + to_create > 2000 then
    raise exception 'quota_exceeded: applications (% existing + % new > 2000)', existing_apps, to_create using errcode = 'PT429';
  end if;

  for r in select * from public.import_rows where batch_id = b.id order by ordinal loop
    if r.decision = 'skip' then
      update public.import_rows set outcome = 'skipped' where id = r.id; skipped := skipped + 1;
    elsif r.decision = 'linked' then
      if r.linked_application_id is null or not exists (select 1 from public.applications where id = r.linked_application_id and user_id = uid) then
        update public.import_rows set outcome = 'failed', errors = errors || '[{"code":"link_target_missing"}]'::jsonb where id = r.id; failed := failed + 1;
      else
        update public.import_rows set outcome = 'linked' where id = r.id; linked := linked + 1;
      end if;
    else
      begin
        a := app_private.insert_application(uid, r.proposed || jsonb_build_object('import_batch_id', b.id), 'import');
        update public.import_rows set outcome = 'created', application_id = a.id where id = r.id;
        created := created + 1;
      exception when others then
        update public.import_rows set outcome = 'failed', errors = errors || jsonb_build_array(jsonb_build_object('code', 'commit_failed', 'sqlstate', sqlstate)) where id = r.id;
        failed := failed + 1;
      end;
    end if;
  end loop;

  total := created + linked + skipped + failed;
  update public.import_batches set state = 'committed', committed_at = now(),
    summary = jsonb_build_object('created', created, 'linked', linked, 'skipped', skipped, 'failed', failed, 'total', total)
  where id = b.id returning summary into b.summary;
  return b.summary;
end $$;

create or replace function public.undo_import_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := app_private.require_active(); b public.import_batches; trashed int; kept int;
begin
  select * into b from public.import_batches where id = p_batch_id and user_id = uid for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if b.state <> 'committed' then raise exception 'batch is %', b.state using errcode = 'PT409'; end if;

  with unchanged as (
    select a.id from public.applications a
    where a.user_id = uid and a.import_batch_id = b.id and a.trashed_at is null and a.revision = 1
      and not exists (select 1 from public.application_notes n where n.application_id = a.id)
      and not exists (select 1 from public.tasks t where t.application_id = a.id)
      and not exists (select 1 from public.interview_events i where i.application_id = a.id and i.origin <> 'import')
      and not exists (select 1 from public.application_status_events e where e.application_id = a.id and e.origin <> 'import')
  ), t as (
    update public.applications a set trashed_at = now() from unchanged u where a.id = u.id returning a.id
  ) select count(*) into trashed from t;
  select count(*) into kept from public.applications where user_id = uid and import_batch_id = b.id and trashed_at is null;

  update public.import_batches set state = 'undone', summary = summary || jsonb_build_object('undo_trashed', trashed, 'undo_kept_for_review', kept) where id = b.id;
  return jsonb_build_object('trashed', trashed, 'kept_for_review', kept);
end $$;

-- ---------------------------------------------------------------- resumes
create or replace function public.reserve_resume_upload(
  p_label text, p_filename text, p_mime text, p_size bigint, p_sha256 text,
  p_source_link text default null, p_source_date date default null, p_role_tags text[] default '{}',
  p_notes text default null, p_allow_duplicate boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := app_private.require_active(); rid uuid := gen_random_uuid(); dup uuid; n int; bytes bigint; v int; path text;
begin
  if not app_private.rate_hit('u:' || uid::text || ':upload_reservation', 20, 3600) then
    raise exception 'rate_limited: uploads' using errcode = 'PT429';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('resumes' || uid::text, 0));
  if not p_allow_duplicate then
    select id into dup from public.resume_versions where user_id = uid and sha256 = p_sha256 and state = 'ready' limit 1;
    if found then return jsonb_build_object('status', 'duplicate', 'resume_id', dup); end if;
  end if;
  select count(*), coalesce(sum(size_bytes), 0) into n, bytes from public.resume_versions
   where user_id = uid and (state in ('ready', 'delete_pending') or (state = 'pending_upload' and reservation_expires_at > now()));
  if n >= 20 then raise exception 'quota_exceeded: resume versions' using errcode = 'PT429'; end if;
  if bytes + p_size > 104857600 then raise exception 'quota_exceeded: resume storage' using errcode = 'PT429'; end if;
  select coalesce(max(version_number), 0) + 1 into v from public.resume_versions where user_id = uid;
  path := uid::text || '/' || rid::text || '/' || left(regexp_replace(p_filename, '[^A-Za-z0-9._-]', '_', 'g'), 100);
  insert into public.resume_versions (id, user_id, version_number, label, storage_path, original_filename, mime_type, size_bytes, sha256,
                                       source_link, source_date, role_tags, notes, state, reservation_expires_at)
  values (rid, uid, v, p_label, path, p_filename, p_mime, p_size, p_sha256, p_source_link, p_source_date, coalesce(p_role_tags, '{}'), p_notes,
          'pending_upload', now() + interval '15 minutes');
  return jsonb_build_object('status', 'reserved', 'resume_id', rid, 'storage_path', path, 'version_number', v);
end $$;

create or replace function public.finalize_resume_upload(p_resume_id uuid)
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare uid uuid := app_private.require_active(); r public.resume_versions; obj_size bigint; found_obj boolean;
begin
  select * into r from public.resume_versions where id = p_resume_id and user_id = uid for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if r.state = 'ready' then return to_jsonb(r); end if;
  if r.state <> 'pending_upload' then raise exception 'resume is %', r.state using errcode = 'PT409'; end if;
  select true, nullif(metadata ->> 'size', '')::bigint into found_obj, obj_size
    from storage.objects where bucket_id = 'resumes' and name = r.storage_path;
  if not coalesce(found_obj, false) then raise exception 'object_missing' using errcode = 'PT409'; end if;
  if obj_size is not null and obj_size <> r.size_bytes then
    update public.resume_versions set state = 'failed', reservation_expires_at = null where id = r.id;
    raise exception 'size_mismatch' using errcode = 'PT422';
  end if;
  update public.resume_versions set state = 'ready', reservation_expires_at = null, updated_at = now() where id = r.id returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.set_default_resume(p_resume_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := app_private.require_active();
begin
  if not exists (select 1 from public.resume_versions where id = p_resume_id and user_id = uid and state = 'ready') then
    raise exception 'not found' using errcode = 'PT404';
  end if;
  insert into public.resume_defaults (user_id, resume_id) values (uid, p_resume_id)
  on conflict (user_id) do update set resume_id = excluded.resume_id, updated_at = now();
end $$;

create or replace function public.begin_resume_delete(p_resume_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := app_private.require_active(); r public.resume_versions;
begin
  select * into r from public.resume_versions where id = p_resume_id and user_id = uid for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if exists (select 1 from public.applications where resume_version_id = r.id) then
    raise exception 'resume_in_use' using errcode = 'PT409';
  end if;
  delete from public.resume_defaults where user_id = uid and resume_id = r.id;
  update public.resume_versions set state = 'delete_pending', updated_at = now() where id = r.id;
  return r.storage_path;
end $$;

create or replace function public.finish_resume_delete(p_resume_id uuid)
returns void language plpgsql security definer set search_path = public, storage as $$
declare uid uuid := app_private.require_active(); r public.resume_versions;
begin
  select * into r from public.resume_versions where id = p_resume_id and user_id = uid for update;
  if not found then return; end if;
  if r.state not in ('delete_pending', 'failed') then raise exception 'resume is %', r.state using errcode = 'PT409'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'resumes' and name = r.storage_path) then
    raise exception 'object_still_present' using errcode = 'PT409';
  end if;
  delete from public.resume_versions where id = r.id;
end $$;

-- ---------------------------------------------------------------- account deletion
create or replace function public.request_account_deletion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid()); req public.account_deletion_requests;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'PT403'; end if;
  insert into public.account_states (user_id, state) values (uid, 'deletion_requested')
  on conflict (user_id) do update set state = 'deletion_requested', updated_at = now();
  insert into public.account_deletion_requests (user_id) values (uid) on conflict (user_id) do nothing;
  select * into req from public.account_deletion_requests where user_id = uid;
  return jsonb_build_object('request_id', req.id, 'state', req.state, 'requested_at', req.requested_at);
end $$;

-- ---------------------------------------------------------------- discovery (ingestion role)
create or replace function public.get_enabled_sources()
returns table (id uuid, repo_owner text, repo_name text, path text, adapter_id text, adapter_version text,
               default_branch text, license text, attribution text, etag text, last_commit_sha text, accepted_row_count integer)
language sql stable security definer set search_path = public as $$
  select id, repo_owner, repo_name, path, adapter_id, adapter_version, default_branch, license, attribution, etag, last_commit_sha, accepted_row_count
  from public.job_sources where enabled;
$$;

create or replace function public.acquire_discovery_lease(p_trigger text, p_correlation uuid, p_runner text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  update public.discovery_runs set state = 'failed', error_code = 'lease_expired', finished_at = now()
   where state = 'running' and lease_expires_at < now();
  begin
    insert into public.discovery_runs (trigger, correlation_id, runner_id, lease_expires_at)
    values (p_trigger, p_correlation, left(p_runner, 80), now() + interval '30 minutes') returning id into rid;
  exception when unique_violation then
    return null;
  end;
  return rid;
end $$;

create or replace function public.finish_discovery_run(p_run_id uuid, p_state text, p_counts jsonb, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.discovery_runs set state = p_state, counts = coalesce(p_counts, '{}'), error_code = left(p_error, 64), finished_at = now()
  where id = p_run_id and state = 'running' and p_state in ('success', 'partial', 'failed', 'held_for_review');
$$;

create or replace function public.record_source_failure(p_run_id uuid, p_source_id uuid, p_error_code text, p_diag jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.source_runs (discovery_run_id, source_id, state, diagnostics)
  values (p_run_id, p_source_id, 'failed', jsonb_build_object('error_code', left(p_error_code, 64)) || coalesce(p_diag, '{}'));
$$;

create or replace function public.record_source_not_modified(p_run_id uuid, p_source_id uuid, p_etag text, p_commit_sha text)
returns void language plpgsql security definer set search_path = public as $$
declare src public.job_sources;
begin
  select * into src from public.job_sources where id = p_source_id and enabled;
  if not found or src.accepted_row_count = 0 then
    insert into public.source_runs (discovery_run_id, source_id, state, diagnostics)
    values (p_run_id, p_source_id, 'failed', '{"error_code":"not_modified_without_baseline"}');
    return;
  end if;
  insert into public.source_runs (discovery_run_id, source_id, state, commit_sha, complete, row_count, baseline_row_count)
  values (p_run_id, p_source_id, 'not_modified', p_commit_sha, true, src.accepted_row_count, src.accepted_row_count);
  update public.job_sources set last_success_at = now(), etag = coalesce(p_etag, etag), last_commit_sha = coalesce(p_commit_sha, last_commit_sha) where id = p_source_id;
end $$;

-- Applies an already-validated snapshot. Caller is responsible for completeness/anomaly checks.
create or replace function app_private.apply_snapshot(p_src public.job_sources, p_source_run uuid, p_rows jsonb, p_commit_sha text, p_etag text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; obs public.job_observations; jid uuid; new_state text; created_jobs int := 0; new_obs int := 0; changed int := 0; marked_missing int := 0;
  ctext text; cand uuid;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    new_state := case when r ->> 'state' = 'source_closed' then 'source_closed' else 'listed' end;
    select * into obs from public.job_observations where source_id = p_src.id and entry_key = r ->> 'entry_key';
    if found then
      jid := obs.job_id;
      if obs.row_hash <> r ->> 'row_hash' or obs.state <> new_state then
        update public.jobs set
          title = r ->> 'title', company = r ->> 'company', role_category = r ->> 'role_category', locations = coalesce(r -> 'locations', '[]'),
          work_mode = r ->> 'work_mode', apply_url = coalesce(r ->> 'apply_url', apply_url), requirements = coalesce(r -> 'requirements', '{}'),
          search_text = lower((r ->> 'company') || ' ' || (r ->> 'title'))
        where id = jid;
        insert into public.job_observation_events (observation_id, source_run_id, event_type, snapshot)
        values (obs.id, p_source_run,
          case when obs.state = 'listed' and new_state = 'source_closed' then 'closed'
               when obs.state <> 'listed' and new_state = 'listed' then 'reopened' else 'changed' end, r);
        changed := changed + 1;
      end if;
      update public.job_observations set row_hash = r ->> 'row_hash', snapshot = r, state = new_state, permalink = r ->> 'permalink',
        last_seen_at = now(), missing_count = 0, first_missing_at = null, source_run_id = p_source_run where id = obs.id;
    else
      jid := null;
      if nullif(r ->> 'identity_key', '') is not null then
        select coalesce(superseded_by, id) into jid from public.jobs where identity_key = r ->> 'identity_key';
      end if;
      if jid is null then
        insert into public.jobs (company, title, role_category, season, season_year, locations, country, work_mode, apply_url, canonical_url,
          identity_key, candidate_key, ats_namespace, employer_namespace, requisition_id, normalization_version, requirements,
          source_posted_year, source_posted_month, source_posted_day, source_posted_precision, search_text)
        values (r ->> 'company', r ->> 'title', r ->> 'role_category', nullif(r ->> 'season', ''), nullif(r ->> 'season_year', '')::smallint,
          coalesce(r -> 'locations', '[]'), r ->> 'country', r ->> 'work_mode', r ->> 'apply_url', r ->> 'canonical_url',
          nullif(r ->> 'identity_key', ''), r ->> 'candidate_key', r ->> 'ats_namespace', r ->> 'employer_namespace', r ->> 'requisition_id',
          coalesce(r ->> 'normalization_version', '1'), coalesce(r -> 'requirements', '{}'),
          (r -> 'source_posted' ->> 'year')::smallint, (r -> 'source_posted' ->> 'month')::smallint, (r -> 'source_posted' ->> 'day')::smallint,
          coalesce(r -> 'source_posted' ->> 'precision', 'unknown'), lower((r ->> 'company') || ' ' || (r ->> 'title')))
        returning id into jid;
        created_jobs := created_jobs + 1;
        if r ->> 'candidate_key' is not null then
          for cand in select id from public.jobs where candidate_key = r ->> 'candidate_key' and id <> jid and superseded_by is null loop
            insert into public.job_merge_candidates (job_a, job_b, reason) values (least(jid, cand), greatest(jid, cand), 'same company, title, locations and season')
            on conflict do nothing;
          end loop;
        end if;
      end if;
      insert into public.job_observations (job_id, source_id, source_run_id, entry_key, permalink, row_hash, snapshot, state)
      values (jid, p_src.id, p_source_run, r ->> 'entry_key', r ->> 'permalink', r ->> 'row_hash', r, new_state) returning * into obs;
      insert into public.job_observation_events (observation_id, source_run_id, event_type, snapshot) values (obs.id, p_source_run, 'first_seen', r);
      new_obs := new_obs + 1;
    end if;
  end loop;

  -- Missing reconciliation (complete valid snapshots only): needs 2 snapshots >= 24h apart.
  with missing as (
    update public.job_observations o set
      missing_count = o.missing_count + 1,
      first_missing_at = coalesce(o.first_missing_at, now()),
      state = case when o.missing_count + 1 >= 2 and now() - coalesce(o.first_missing_at, now()) >= interval '24 hours'
                   then 'missing_from_source' else o.state end
    where o.source_id = p_src.id and o.source_run_id is distinct from p_source_run
    returning o.id, o.state
  ), ev as (
    insert into public.job_observation_events (observation_id, source_run_id, event_type, snapshot)
    select m.id, p_source_run, 'missing', '{}'::jsonb from missing m where m.state = 'missing_from_source'
      and not exists (select 1 from public.job_observation_events x where x.observation_id = m.id and x.event_type = 'missing')
    returning 1
  ) select count(*) into marked_missing from ev;

  update public.jobs j set
    last_seen_at = now(),
    availability = case
      when exists (select 1 from public.job_observations o where o.job_id = j.id and o.state = 'listed') then 'listed'
      when exists (select 1 from public.job_observations o where o.job_id = j.id and o.state = 'source_closed') then 'source_closed'
      else 'missing_from_source' end
  where exists (select 1 from public.job_observations o where o.job_id = j.id and o.source_id = p_src.id);

  update public.job_sources set accepted_row_count = jsonb_array_length(p_rows), last_success_at = now(),
    last_commit_sha = coalesce(p_commit_sha, last_commit_sha), etag = coalesce(p_etag, etag) where id = p_src.id;

  return jsonb_build_object('rows', jsonb_array_length(p_rows), 'new_jobs', created_jobs, 'new_observations', new_obs, 'changed', changed, 'marked_missing', marked_missing);
end $$;

create or replace function public.ingest_source_snapshot(
  p_run_id uuid, p_source_id uuid, p_commit_sha text, p_payload_hash text, p_etag text,
  p_complete boolean, p_quarantined integer, p_diag jsonb, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  src public.job_sources; n int; baseline int; sr uuid; summary jsonb;
begin
  if not exists (select 1 from public.discovery_runs where id = p_run_id and state = 'running') then
    raise exception 'no active run lease' using errcode = 'PT409';
  end if;
  select * into src from public.job_sources where id = p_source_id and enabled for update;
  if not found then raise exception 'source not found or disabled' using errcode = 'PT404'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array' using errcode = 'PT422'; end if;
  n := jsonb_array_length(p_rows);
  baseline := src.accepted_row_count;

  if not p_complete or n = 0 then
    insert into public.source_runs (discovery_run_id, source_id, state, commit_sha, payload_hash, complete, row_count, quarantined_count, baseline_row_count, diagnostics)
    values (p_run_id, p_source_id, 'failed', p_commit_sha, p_payload_hash, p_complete, n, coalesce(p_quarantined, 0), baseline,
      coalesce(p_diag, '{}') || jsonb_build_object('error_code', case when n = 0 then 'empty_snapshot' else 'incomplete_snapshot' end));
    return jsonb_build_object('state', 'failed', 'reason', case when n = 0 then 'empty_snapshot' else 'incomplete_snapshot' end);
  end if;

  if baseline > 0 and n < baseline * 0.5 then
    insert into public.source_runs (discovery_run_id, source_id, state, commit_sha, payload_hash, complete, row_count, quarantined_count, baseline_row_count, diagnostics, held_payload)
    values (p_run_id, p_source_id, 'held_for_review', p_commit_sha, p_payload_hash, true, n, coalesce(p_quarantined, 0), baseline,
      coalesce(p_diag, '{}') || '{"error_code":"suspicious_row_drop"}', p_rows);
    return jsonb_build_object('state', 'held_for_review', 'rows', n, 'baseline', baseline);
  end if;

  insert into public.source_runs (discovery_run_id, source_id, state, commit_sha, payload_hash, complete, row_count, quarantined_count, baseline_row_count, diagnostics)
  values (p_run_id, p_source_id, 'success', p_commit_sha, p_payload_hash, true, n, coalesce(p_quarantined, 0), baseline, coalesce(p_diag, '{}'))
  returning id into sr;
  summary := app_private.apply_snapshot(src, sr, p_rows, p_commit_sha, p_etag);
  return summary || '{"state":"success"}';
end $$;

-- ---------------------------------------------------------------- administration
create or replace function app_private.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or not public.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  return uid;
end $$;

create or replace function public.admin_set_source_enabled(p_source_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform app_private.require_admin();
  update public.job_sources set enabled = p_enabled where id = p_source_id;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  perform app_private.audit(case when p_enabled then 'source_enabled' else 'source_disabled' end, 'job_source', p_source_id::text);
end $$;

create or replace function public.admin_resolve_held_snapshot(p_source_run_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sr public.source_runs; src public.job_sources; summary jsonb;
begin
  perform app_private.require_admin();
  select * into sr from public.source_runs where id = p_source_run_id and state = 'held_for_review' for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if p_approve then
    select * into src from public.job_sources where id = sr.source_id for update;
    summary := app_private.apply_snapshot(src, sr.id, sr.held_payload, sr.commit_sha, null);
    update public.source_runs set state = 'approved', held_payload = null where id = sr.id;
  else
    update public.source_runs set state = 'failed', held_payload = null, diagnostics = diagnostics || '{"resolution":"rejected"}' where id = sr.id;
    summary := '{"rejected":true}';
  end if;
  perform app_private.audit(case when p_approve then 'held_snapshot_approved' else 'held_snapshot_rejected' end, 'source_run', p_source_run_id::text);
  return summary;
end $$;

create or replace function public.admin_merge_jobs(p_keep uuid, p_merge uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := app_private.require_admin(); k public.jobs; m public.jobs; moved int; remapped int := 0; uj public.user_jobs; kj public.user_jobs;
begin
  if p_keep = p_merge then raise exception 'cannot merge a job into itself' using errcode = 'PT422'; end if;
  select * into k from public.jobs where id = p_keep and superseded_by is null for update;
  select * into m from public.jobs where id = p_merge and superseded_by is null for update;
  if k.id is null or m.id is null then raise exception 'not found' using errcode = 'PT404'; end if;

  update public.job_observations set job_id = k.id where job_id = m.id;
  get diagnostics moved = row_count;

  for uj in select * from public.user_jobs where job_id = m.id loop
    select * into kj from public.user_jobs where user_id = uj.user_id and job_id = k.id;
    if found then
      update public.user_jobs set saved = kj.saved or uj.saved, hidden = kj.hidden or uj.hidden,
        verification_state = case when kj.verification_state = 'none' then uj.verification_state else kj.verification_state end,
        verification_url = case when kj.verification_state = 'none' then uj.verification_url else kj.verification_url end,
        verification_note = case when kj.verification_state = 'none' then uj.verification_note else kj.verification_note end,
        verified_at = case when kj.verification_state = 'none' then uj.verified_at else kj.verified_at end
      where id = kj.id;
      delete from public.user_jobs where id = uj.id;
    else
      update public.user_jobs set job_id = k.id where id = uj.id;
    end if;
    remapped := remapped + 1;
  end loop;
  update public.applications set job_id = k.id where job_id = m.id;
  update public.tasks set job_id = k.id where job_id = m.id;
  update public.catalog_verifications set job_id = k.id where job_id = m.id;
  update public.jobs set first_seen_at = least(first_seen_at, m.first_seen_at) where id = k.id;
  update public.jobs set superseded_by = k.id, merged_at = now() where id = m.id;
  update public.job_merge_candidates set state = 'merged' where job_a in (k.id, m.id) and job_b in (k.id, m.id);
  insert into public.job_merge_events (kept_job_id, merged_job_id, admin_id, moved_observations, remapped_user_jobs) values (k.id, m.id, uid, moved, remapped);
  perform app_private.audit('job_merged', 'job', k.id::text, jsonb_build_object('merged', m.id));
  return jsonb_build_object('moved_observations', moved, 'remapped_user_jobs', remapped);
end $$;

create or replace function public.admin_dismiss_merge_candidate(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform app_private.require_admin();
  update public.job_merge_candidates set state = 'dismissed' where id = p_id and state = 'open';
  perform app_private.audit('merge_candidate_dismissed', 'job_merge_candidate', p_id::text);
end $$;

create or replace function public.admin_add_catalog_verification(p_job_id uuid, p_url text, p_note text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := app_private.require_admin();
begin
  if not exists (select 1 from public.jobs where id = p_job_id) then raise exception 'not found' using errcode = 'PT404'; end if;
  insert into public.catalog_verifications (job_id, admin_id, evidence_url, evidence_note, state) values (p_job_id, uid, p_url, p_note, p_state);
  perform app_private.audit('catalog_verified', 'job', p_job_id::text, jsonb_build_object('state', p_state));
end $$;

create or replace function public.admin_set_account_state(p_user uuid, p_state text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := app_private.require_admin(); cur text;
begin
  if p_state not in ('active', 'suspended') then raise exception 'invalid state' using errcode = 'PT422'; end if;
  if p_user = uid then raise exception 'cannot change own account state' using errcode = 'PT422'; end if;
  select state into cur from public.account_states where user_id = p_user for update;
  if not found then raise exception 'not found' using errcode = 'PT404'; end if;
  if cur = 'deletion_requested' then raise exception 'account is being deleted' using errcode = 'PT409'; end if;
  update public.account_states set state = p_state, reason_code = left(p_reason, 64), updated_at = now() where user_id = p_user;
  perform app_private.audit('account_' || p_state, 'account', p_user::text, jsonb_build_object('reason', left(p_reason, 64)));
end $$;

create or replace function public.admin_list_accounts(p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, email text, created_at timestamptz, email_confirmed boolean, state text, is_admin boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  return query
    select u.id, u.email::text, u.created_at, u.email_confirmed_at is not null, coalesce(s.state, 'active'),
           exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
    from auth.users u left join public.account_states s on s.user_id = u.id
    order by u.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;

-- Aggregate counts only: no private content.
create or replace function public.admin_capacity_metrics()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  return jsonb_build_object(
    'accounts_total', (select count(*) from auth.users),
    'accounts_active', (select count(*) from public.account_states where state = 'active'),
    'accounts_suspended', (select count(*) from public.account_states where state = 'suspended'),
    'deletion_requests_open', (select count(*) from public.account_deletion_requests where state <> 'completed'),
    'deletion_requests_stale', (select count(*) from public.account_deletion_requests where state <> 'completed' and requested_at < now() - interval '24 hours'),
    'resume_bytes', (select coalesce(sum(size_bytes), 0) from public.resume_versions where state in ('ready', 'delete_pending')),
    'jobs', (select count(*) from public.jobs where superseded_by is null),
    'open_merge_candidates', (select count(*) from public.job_merge_candidates where state = 'open'),
    'held_snapshots', (select count(*) from public.source_runs where state = 'held_for_review'));
end $$;

create or replace function public.admin_claim_refresh(p_correlation uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform app_private.require_admin();
  perform pg_advisory_xact_lock(hashtextextended('refresh_dispatch', 0));
  if exists (select 1 from public.admin_audit_events where action = 'refresh_dispatch' and created_at > now() - interval '15 minutes') then
    raise exception 'cooldown' using errcode = 'PT429';
  end if;
  perform app_private.audit('refresh_dispatch', 'discovery', p_correlation::text);
  return true;
end $$;

-- ---------------------------------------------------------------- lifecycle worker (service_role only)
create or replace function public.lifecycle_pending_deletions(p_limit integer default 20)
returns setof public.account_deletion_requests language sql security definer set search_path = public as $$
  select * from public.account_deletion_requests where state <> 'completed' order by requested_at limit p_limit;
$$;

create or replace function public.lifecycle_update_deletion(p_user uuid, p_state text, p_checkpoints jsonb, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.account_deletion_requests set state = p_state, checkpoints = checkpoints || coalesce(p_checkpoints, '{}'),
    error_code = left(p_error, 64), retry_count = retry_count + case when p_error is not null then 1 else 0 end, updated_at = now()
  where user_id = p_user;
$$;

-- Expired reservations become 'failed'; every failed row is returned until the worker confirms storage cleanup by deleting it.
create or replace function public.lifecycle_expire_reservations()
returns table (resume_id uuid, user_id uuid, storage_path text) language plpgsql security definer set search_path = public as $$
begin
  update public.resume_versions rv set state = 'failed', reservation_expires_at = null
  where rv.state = 'pending_upload' and rv.reservation_expires_at < now();
  return query select rv.id, rv.user_id, rv.storage_path from public.resume_versions rv where rv.state = 'failed';
end $$;

create or replace function public.lifecycle_delete_resume_rows(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.resume_versions where id = any (p_ids) and state in ('failed', 'delete_pending');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.lifecycle_cleanup_operational()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int;
begin
  delete from public.rate_limits where window_start < now() - interval '2 days'; get diagnostics a = row_count;
  delete from public.operation_keys where created_at < now() - interval '7 days'; get diagnostics b = row_count;
  delete from public.discovery_runs where finished_at < now() - interval '30 days'; get diagnostics c = row_count;
  delete from public.usage_counters where window_start < now() - interval '35 days'; get diagnostics d = row_count;
  update public.source_runs set held_payload = null where held_payload is not null and created_at < now() - interval '14 days';
  return jsonb_build_object('rate_limits', a, 'operation_keys', b, 'discovery_runs', c, 'usage_counters', d);
end $$;

-- ---------------------------------------------------------------- privileges
do $$ begin
  if not exists (select from pg_roles where rolname = 'discovery_ingest') then create role discovery_ingest nologin; end if;
end $$;
grant usage on schema public to discovery_ingest;

-- Functions are PUBLIC-executable by default: strip everything, then grant per role.
revoke execute on all functions in schema public from public, anon, authenticated, discovery_ingest;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function public.is_active_user(), public.is_admin() to authenticated;

grant select on public.job_availability_overlay to authenticated;
grant execute on function
  public.ensure_account(), public.rate_limit_user(text, integer, integer),
  public.create_application(jsonb, text),
  public.change_application_status(uuid, integer, text, text, timestamptz, boolean, jsonb, boolean, text),
  public.commit_import_batch(uuid), public.undo_import_batch(uuid),
  public.reserve_resume_upload(text, text, text, bigint, text, text, date, text[], text, boolean),
  public.finalize_resume_upload(uuid), public.set_default_resume(uuid), public.begin_resume_delete(uuid), public.finish_resume_delete(uuid),
  public.request_account_deletion(),
  public.admin_set_source_enabled(uuid, boolean), public.admin_resolve_held_snapshot(uuid, boolean), public.admin_merge_jobs(uuid, uuid),
  public.admin_dismiss_merge_candidate(uuid), public.admin_add_catalog_verification(uuid, text, text, text),
  public.admin_set_account_state(uuid, text, text), public.admin_list_accounts(integer, integer), public.admin_capacity_metrics(),
  public.admin_claim_refresh(uuid)
  to authenticated;
grant execute on function public.rate_limit_public(text, text, integer, integer) to anon, authenticated;

grant execute on function
  public.get_enabled_sources(), public.acquire_discovery_lease(text, uuid, text), public.finish_discovery_run(uuid, text, jsonb, text),
  public.record_source_failure(uuid, uuid, text, jsonb), public.record_source_not_modified(uuid, uuid, text, text),
  public.ingest_source_snapshot(uuid, uuid, text, text, text, boolean, integer, jsonb, jsonb)
  to discovery_ingest;

grant execute on function
  public.lifecycle_pending_deletions(integer), public.lifecycle_update_deletion(uuid, text, jsonb, text),
  public.lifecycle_expire_reservations(), public.lifecycle_delete_resume_rows(uuid[]), public.lifecycle_cleanup_operational()
  to service_role;
