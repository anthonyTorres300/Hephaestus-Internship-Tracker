-- Rank columns so status and priority sort in pipeline order instead of alphabetically.
alter table public.applications
  add column priority_rank smallint generated always as (
    case priority when 'high' then 1 when 'medium' then 2 else 3 end
  ) stored,
  add column status_rank smallint generated always as (
    case status
      when 'saved' then 1 when 'prepared' then 2 when 'applied' then 3 when 'screening' then 4
      when 'assessment' then 5 when 'interview' then 6 when 'offer' then 7 when 'accepted' then 8
      when 'rejected' then 9 when 'withdrawn' then 10 else 11
    end
  ) stored;
