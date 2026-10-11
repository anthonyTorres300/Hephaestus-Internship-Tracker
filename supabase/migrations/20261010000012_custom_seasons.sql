-- Applications may use a custom season name (e.g. "co-op", "spring semester"); jobs keep the four standard seasons.
alter table public.applications drop constraint if exists applications_season_check;
alter table public.applications
  add constraint applications_season_check check (season is null or (char_length(season) between 1 and 30 and season !~ '[[:cntrl:]]'));
