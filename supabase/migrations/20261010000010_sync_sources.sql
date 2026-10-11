-- Automatic source sync: the discovery runner calls public.sync_job_sources() at the start of every run with the checked-in
-- configuration (src/lib/discovery/sources.ts), so adding a repo there needs no manual SQL after this migration.
--
-- Rules: key is (repo_owner, repo_name, path, adapter_id). New rows are inserted enabled. Existing rows are never re-enabled or
-- disabled (an admin may have turned a source off); adapter_version, license, attribution and default_branch are only filled
-- in when currently null. Every element is validated and the whole call raises on invalid input. Returns the number of newly inserted rows.

create or replace function public.sync_job_sources(p_sources jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s jsonb; n integer := 0; k text; cnt integer;
begin
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' then
    raise exception 'sources must be a json array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sources) > 50 then
    raise exception 'too many sources (max 50)' using errcode = '22023';
  end if;
  -- Validate everything first so invalid input never produces a partial sync.
  for s in select * from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(s) <> 'object' then raise exception 'source must be an object' using errcode = '22023'; end if;
    foreach k in array array['owner', 'repo', 'path', 'adapterId', 'adapterVersion', 'license', 'attribution', 'defaultBranch'] loop
      if s -> k is not null and jsonb_typeof(s -> k) <> 'string' and jsonb_typeof(s -> k) <> 'null' then
        raise exception 'invalid source field %', k using errcode = '22023';
      end if;
    end loop;
    if coalesce(s ->> 'owner', '') !~ '^[A-Za-z0-9_.-]{1,100}$' then raise exception 'invalid owner' using errcode = '22023'; end if;
    if coalesce(s ->> 'repo', '') !~ '^[A-Za-z0-9_.-]{1,100}$' then raise exception 'invalid repo' using errcode = '22023'; end if;
    if coalesce(s ->> 'path', '') !~ '^[A-Za-z0-9_./-]{1,200}$' or s ->> 'path' ~ '(^|/)\.\.?(/|$)' or s ->> 'path' ~ '^/' then
      raise exception 'invalid path' using errcode = '22023';
    end if;
    if coalesce(s ->> 'adapterId', '') !~ '^[a-z0-9_-]{1,40}$' then raise exception 'invalid adapterId' using errcode = '22023'; end if;
    if coalesce(s ->> 'adapterVersion', '1') !~ '^[A-Za-z0-9_.-]{1,20}$' then raise exception 'invalid adapterVersion' using errcode = '22023'; end if;
    if length(coalesce(s ->> 'license', '')) > 100 then raise exception 'license too long' using errcode = '22023'; end if;
    if length(coalesce(s ->> 'attribution', '')) > 1000 then raise exception 'attribution too long' using errcode = '22023'; end if;
    if coalesce(s ->> 'defaultBranch', 'main') !~ '^[A-Za-z0-9_./-]{1,100}$' then raise exception 'invalid defaultBranch' using errcode = '22023'; end if;
  end loop;

  for s in select * from jsonb_array_elements(p_sources) loop
    select count(*) into cnt from public.job_sources
      where repo_owner = s ->> 'owner' and repo_name = s ->> 'repo' and path = s ->> 'path' and adapter_id = s ->> 'adapterId';
    if cnt = 0 then n := n + 1; end if;
    insert into public.job_sources (repo_owner, repo_name, path, adapter_id, adapter_version, default_branch, enabled, license, attribution)
    values (s ->> 'owner', s ->> 'repo', s ->> 'path', s ->> 'adapterId', coalesce(s ->> 'adapterVersion', '1'),
            nullif(s ->> 'defaultBranch', ''), true, nullif(s ->> 'license', ''), nullif(s ->> 'attribution', ''))
    on conflict (repo_owner, repo_name, path, adapter_id) do update set
      adapter_version = coalesce(public.job_sources.adapter_version, excluded.adapter_version),
      license = coalesce(public.job_sources.license, excluded.license),
      attribution = coalesce(public.job_sources.attribution, excluded.attribution),
      default_branch = coalesce(public.job_sources.default_branch, excluded.default_branch)
    where (public.job_sources.adapter_version is null and excluded.adapter_version is not null)
       or (public.job_sources.license is null and excluded.license is not null)
       or (public.job_sources.attribution is null and excluded.attribution is not null)
       or (public.job_sources.default_branch is null and excluded.default_branch is not null);
  end loop;
  return n;
end $$;

revoke execute on function public.sync_job_sources(jsonb) from public, anon, authenticated;
grant execute on function public.sync_job_sources(jsonb) to discovery_ingest;

-- New sources (mirror of src/lib/discovery/sources.ts), so running just this file is enough. default_branch is informational;
-- the runner resolves the real default branch through the GitHub API.
insert into public.job_sources (repo_owner, repo_name, path, adapter_id, adapter_version, default_branch, enabled, license, attribution)
values
  ('aprameyak', '2027-tech-jobs', 'SUMMER.md', 'aprameyak', '1', 'main', true, 'MIT',
   'Listings from aprameyak/2027-tech-jobs (SUMMER.md), MIT License, Copyright (c) 2026 Aprameya Kannan.'),
  ('aprameyak', '2027-tech-jobs', 'OFFCYCLE.md', 'aprameyak', '1', 'main', true, 'MIT',
   'Listings from aprameyak/2027-tech-jobs (OFFCYCLE.md), MIT License, Copyright (c) 2026 Aprameya Kannan.'),
  ('jobbie-bot', 'Summer-2027-Tech-Internships', 'README.md', 'jobbie', '1', 'main', true, 'MIT',
   'Listings from jobbie-bot/Summer-2027-Tech-Internships (Jobbie), MIT License, Copyright (c) 2026 Jobbie.'),
  ('resumax', 'tech-internships', 'README.md', 'resumax', '1', 'main', true, 'MIT',
   'Listings from resumax/tech-internships (ResuMax), MIT License, Copyright (c) 2026 ResuMax.'),
  ('zshah101', 'Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships', 'README.md', 'zshah', '1', 'main', true, 'MIT',
   'Listings from zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships, MIT License, Copyright (c) 2026 Shah Zain.'),
  ('jobright-ai', '2026-Software-Engineer-Internship', 'README.md', 'jobright', '1', 'master', true, 'none-declared',
   'Listings from jobright-ai/2026-Software-Engineer-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.'),
  ('jobright-ai', '2026-Data-Analysis-Internship', 'README.md', 'jobright', '1', 'master', true, 'none-declared',
   'Listings from jobright-ai/2026-Data-Analysis-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.'),
  ('jobright-ai', '2026-Engineer-Internship', 'README.md', 'jobright', '1', 'master', true, 'none-declared',
   'Listings from jobright-ai/2026-Engineer-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.')
on conflict (repo_owner, repo_name, path, adapter_id) do nothing;
