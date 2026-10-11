-- Synthetic development data only. Never put real personal, resume or application data here.
-- Applied by `supabase db reset` after migrations. The two real catalog sources are seeded by migration 20261010000006.

-- Synthetic job listings for local UI development (not scraped, not real employers).
insert into public.jobs (company, title, role_category, season, season_year, locations, country, work_mode, apply_url, canonical_url, identity_key, candidate_key, requirements, search_text)
values
  ('Northwind Aerospace', 'Software Engineering Intern', 'software', 'summer', 2027, '["Austin, TX"]', 'US', 'onsite',
   'https://careers.example.test/northwind/1001', 'https://careers.example.test/northwind/1001', 'url:https://careers.example.test/northwind/1001', 'northwind|swe intern|summer2027',
   '{"graduation_from":{"year":2028,"month":12},"graduation_to":{"year":2029,"month":12}}', 'northwind aerospace software engineering intern'),
  ('Contoso Labs', 'Backend Engineering Intern', 'backend', 'summer', 2027, '["Remote - US"]', 'US', 'remote',
   'https://careers.example.test/contoso/2002', 'https://careers.example.test/contoso/2002', 'url:https://careers.example.test/contoso/2002', 'contoso|backend intern|summer2027',
   '{}', 'contoso labs backend engineering intern'),
  ('Fabrikam Robotics', 'Autonomy Software Intern', 'autonomous_robotics', 'summer', 2027, '["Pittsburgh, PA"]', 'US', 'hybrid',
   'https://careers.example.test/fabrikam/3003', 'https://careers.example.test/fabrikam/3003', 'url:https://careers.example.test/fabrikam/3003', 'fabrikam|autonomy intern|summer2027',
   '{"requires_us_person":true}', 'fabrikam robotics autonomy software intern')
on conflict do nothing;
