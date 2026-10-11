-- User-defined seasons ("Summer 2026", "Co-op 2027"). A season gets a tab on the Applications page even before it has applications.
create table public.user_seasons (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30 and name !~ '[[:cntrl:]]' and name = lower(btrim(name))),
  year smallint not null check (year between 2000 and 2100),
  created_at timestamptz not null default now(),
  primary key (user_id, name, year)
);
alter table public.user_seasons enable row level security;
revoke all on public.user_seasons from public, anon, authenticated;
grant select, insert, delete on public.user_seasons to authenticated;
create policy user_seasons_sel on public.user_seasons for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create policy user_seasons_ins on public.user_seasons for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user());
create policy user_seasons_del on public.user_seasons for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
create trigger cap_user_seasons before insert on public.user_seasons for each row execute function app_private.cap_rows('40');

-- Per-season counts of active (not archived, not trashed) applications; one query feeds every season tab.
-- security_invoker: the caller's row-level security on applications applies.
create view public.application_season_counts with (security_invoker = true) as
  select season, season_year, count(*)::integer as n
  from public.applications
  where trashed_at is null and archived_at is null
  group by season, season_year;
revoke all on public.application_season_counts from public, anon, authenticated;
grant select on public.application_season_counts to authenticated;
