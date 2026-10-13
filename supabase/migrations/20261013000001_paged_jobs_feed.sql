-- Keep the feed's result-level eligibility rules aligned with assessEligibility in the domain layer.
create or replace function public.feed_eligibility(p jsonb, r jsonb, country text)
returns text language plpgsql immutable set search_path = public as $$
declare unknown_rule boolean := false; mine int; lower_bound int; upper_bound int;
  levels jsonb := coalesce(r->'degree_levels', '[]'); allowed jsonb := coalesce(r->'remote_restricted_to','[]');
  matches text[];
begin
  if r->'graduation_from' is null and r->'graduation_to' is null then unknown_rule := true;
  elsif p->>'graduation_year' is null or p->>'graduation_month' is null then unknown_rule := true;
  else
    mine := (p->>'graduation_year')::int * 12 + (p->>'graduation_month')::int;
    lower_bound := (r#>>'{graduation_from,year}')::int * 12 + (r#>>'{graduation_from,month}')::int;
    upper_bound := (r#>>'{graduation_to,year}')::int * 12 + (r#>>'{graduation_to,month}')::int;
    if mine < lower_bound or mine > upper_bound then return 'ineligible'; end if;
  end if;
  if jsonb_array_length(levels) = 0 and coalesce((r->>'graduate_only')::boolean,false) = false then unknown_rule := true;
  elsif p->>'degree' is null or p->>'degree' = 'other' then unknown_rule := true;
  elsif (coalesce((r->>'graduate_only')::boolean,false) and p->>'degree' not in ('masters','phd'))
    or (jsonb_array_length(levels)>0 and not levels ? (p->>'degree')) then return 'ineligible'; end if;
  if country is null or p->>'work_authorized' is null or p->>'work_authorization_country' is null
    or upper(country) <> upper(p->>'work_authorization_country') then unknown_rule := true;
  elsif (p->>'work_authorized')::boolean = false then
    if r->>'sponsorship_offered' = 'false' then return 'ineligible';
    elsif r->>'sponsorship_offered' is null then unknown_rule := true; end if;
  end if;
  if p->>'requires_sponsorship' is null then unknown_rule := true;
  elsif (p->>'requires_sponsorship')::boolean then
    if r->>'sponsorship_offered' = 'false' then return 'ineligible';
    elsif r->>'sponsorship_offered' is null then unknown_rule := true; end if;
  end if;
  if coalesce(r->>'requires_visa_program','') <> '' then unknown_rule := true; end if;
  if jsonb_array_length(coalesce(r->'requires_citizenship','[]')) > 0 then
    if coalesce((p->>'citizenship_known')::boolean,false) = false then unknown_rule := true;
    elsif not exists(select 1 from jsonb_array_elements_text(r->'requires_citizenship') need
      join jsonb_array_elements_text(coalesce(p->'citizenship_countries','[]')) have on upper(need.value)=upper(have.value)) then return 'ineligible'; end if;
  end if;
  if coalesce((r->>'requires_us_person')::boolean,false) then
    if p->>'us_person' is null then unknown_rule := true;
    elsif (p->>'us_person')::boolean = false then return 'ineligible'; end if;
  end if;
  if coalesce((r->>'requires_clearance')::boolean,false) then
    if p->>'clearance_eligible' is null then unknown_rule := true;
    elsif (p->>'clearance_eligible')::boolean = false then return 'ineligible'; end if;
  end if;
  if jsonb_array_length(allowed)>0 then
    if coalesce(p->>'work_authorization_country','')='' and jsonb_array_length(coalesce(p->'preferred_countries','[]'))=0 then unknown_rule := true;
    else
      select array_agg(a.value) into matches from jsonb_array_elements_text(allowed) a
      where upper(split_part(a.value,'-',1))=upper(p->>'work_authorization_country')
        or exists(select 1 from jsonb_array_elements_text(coalesce(p->'preferred_countries','[]')) c where upper(c.value)=upper(split_part(a.value,'-',1)));
      if matches is null then return 'ineligible'; end if;
      if not exists(select 1 from unnest(matches) m where position('-' in m)=0) then unknown_rule := true; end if;
    end if;
  end if;
  return case when unknown_rule then 'needs_review' else 'eligible' end;
end $$;
revoke all on function public.feed_eligibility(jsonb,jsonb,text) from public;
grant execute on function public.feed_eligibility(jsonb,jsonb,text) to authenticated;

-- Invoker rights: every join remains subject to the same RLS as the existing feed.
create or replace function public.jobs_feed_page(p_filters jsonb default '{}', p_page int default 1, p_per int default 25, p_hot jsonb default '[]')
returns jsonb language sql stable security invoker set search_path = public as $$
with profile as (select to_jsonb(p) as p from public.profiles p where user_id=auth.uid()),
base as materialized (
  select j.*, public.feed_eligibility(p.p, coalesce(j.requirements,'{}'),j.country) as eligibility,
    to_jsonb(uj) as user_job,
    a.id as application_id,
    exists(select 1 from public.applications prev where prev.trashed_at is null and prev.job_id is distinct from j.id
      and regexp_replace(lower(prev.company_name),'[^a-z0-9]+',' ','g')=regexp_replace(lower(j.company),'[^a-z0-9]+',' ','g')
      and regexp_replace(lower(prev.role_title),'[^a-z0-9]+',' ','g')=regexp_replace(lower(j.title),'[^a-z0-9]+',' ','g')
      and (prev.season_year is null or j.season_year is null or prev.season_year=j.season_year)) as possible_previous,
    hot.name as hot_company
  from public.jobs j cross join profile p
  left join public.user_jobs uj on uj.job_id=j.id and uj.user_id=auth.uid()
  left join lateral (select id from public.applications a where a.trashed_at is null
    and (a.job_id=j.id or (j.identity_key is not null and a.confirmed_identity=j.identity_key)) order by a.created_at desc,a.id limit 1) a on true
  left join lateral (select h->>'canonical' as name from jsonb_array_elements(p_hot) h
    where (' ' || trim(regexp_replace(lower(j.company),'[^a-z0-9]+',' ','g')) || ' ') like (' ' || (h->>'prefix') || ' %')
    order by length(h->>'prefix') desc limit 1) hot on true
  where j.superseded_by is null and j.availability<>'source_closed'
    and (coalesce(p_filters->>'season','target')='all'
      or (coalesce(p_filters->>'season','target')='target' and j.season=p.p->>'target_season' and j.season_year=(p.p->>'target_year')::int)
      or (p_filters->>'season'='unknown' and (j.season is null or j.season_year is null)))
    and (coalesce(p_filters->>'category','')='' or j.role_category=p_filters->>'category')
    and (jsonb_array_length(coalesce(p_filters->'categories','[]'))=0 or (p_filters->'categories') ? j.role_category)
    and (coalesce(p_filters->>'q','')='' or trim(regexp_replace(lower(j.company || ' ' || j.title || ' ' || coalesce((select string_agg(value,' ') from jsonb_array_elements_text(j.locations)),'')),'[^a-z0-9]+',' ','g')) like '%' || trim(regexp_replace(lower(p_filters->>'q'),'[^a-z0-9]+',' ','g')) || '%')
    and (coalesce((p_filters->>'showHidden')::boolean,false) or not coalesce(uj.hidden,false))
    and (coalesce((p_filters->>'showApplied')::boolean,false) or a.id is null)
    and (not coalesce((p_filters->>'undergradOnly')::boolean,false) or (
      not coalesce((j.requirements->>'graduate_only')::boolean,false)
      and (jsonb_array_length(coalesce(j.requirements->'degree_levels','[]'))=0 or (j.requirements->'degree_levels') ?| array['bachelors','associate'])
      and j.title !~* '\y(ph\.?\s?d|doctoral|doctorate|master''?s|masters|m\.?s\.?\s*(/|or)\s*ph|graduate (student|program|intern|research))\y'))
),
visible as materialized (select * from base where
  (coalesce(p_filters->>'eligibility','')='' and (coalesce((p_filters->>'showIneligible')::boolean,false) or eligibility<>'ineligible'))
  or eligibility=p_filters->>'eligibility'),
companies as (select hot_company as name,count(*) as n from visible where hot_company is not null group by hot_company),
filtered as materialized (select * from visible where
  (coalesce(p_filters->>'company','')='' or hot_company=p_filters->>'company')
  and (not coalesce((p_filters->>'hot')::boolean,false) or hot_company is not null)),
tabbed as materialized (select * from filtered where
  (coalesce(p_filters->>'tab','all')='all'
    or (p_filters->>'tab'='new' and first_seen_at>=now()-interval '48 hours')
    or (p_filters->>'tab'='saved' and coalesce((user_job->>'saved')::boolean,false)))),
counts as (select count(*) as total, greatest(1,least(greatest(1,p_page),ceil(count(*)::numeric/greatest(1,least(100,p_per)))::int)) as page from tabbed),
page_rows as (select * from tabbed order by
  case when p_filters->>'sort'='posted' and source_posted_precision='day' then source_posted_year*10000+source_posted_month*100+source_posted_day end desc nulls last,
  first_seen_at desc,id limit greatest(1,least(100,p_per)) offset ((select page from counts)-1)*greatest(1,least(100,p_per)))
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'),
  'total',(select total from counts),'page',(select page from counts),
  'counts',jsonb_build_object('all',(select count(*) from filtered),'new',(select count(*) from filtered where first_seen_at>=now()-interval '48 hours'),'saved',(select count(*) from filtered where coalesce((user_job->>'saved')::boolean,false))),
  'companies',coalesce((select jsonb_agg(to_jsonb(c) order by n desc,name) from companies c),'[]'))
$$;
revoke all on function public.jobs_feed_page(jsonb,int,int,jsonb) from public;
grant execute on function public.jobs_feed_page(jsonb,int,int,jsonb) to authenticated;
create index if not exists jobs_feed_order_idx on public.jobs(first_seen_at desc,id) where superseded_by is null and availability<>'source_closed';
create index if not exists applications_identity_active_idx on public.applications(user_id,confirmed_identity) where trashed_at is null and confirmed_identity is not null;
