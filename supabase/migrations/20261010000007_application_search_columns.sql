-- Generated helpers so URL-driven search/filter/sort can run server-side with plain PostgREST filters.
alter table public.applications
  add column search_text text generated always as (lower(company_name || ' ' || role_title)) stored,
  add column locations_text text generated always as (lower(locations::text)) stored,
  add column submitted_key integer generated always as (
    coalesce(submitted_year, 0) * 10000 + coalesce(submitted_month, 0) * 100 + coalesce(submitted_day, 0)
  ) stored;

create index applications_search_text_idx on public.applications (user_id, search_text text_pattern_ops);
create index applications_user_updated_idx on public.applications (user_id, updated_at desc);
create index applications_user_submitted_key_idx on public.applications (user_id, submitted_key);
