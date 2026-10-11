-- Additional public GitHub internship lists (mirror of src/lib/discovery/sources.ts). Default branch is resolved via the GitHub API at run time;
-- default_branch here is informational (all five use `main`, checked 2026-10).
insert into public.job_sources (repo_owner, repo_name, path, adapter_id, adapter_version, default_branch, enabled, license, attribution)
values
  ('speedyapply', '2027-SWE-College-Jobs', 'README.md', 'speedyapply', '1', 'main', true, 'none-declared',
   'Listings from speedyapply/2027-SWE-College-Jobs (SpeedyApply). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.'),
  ('speedyapply', '2027-AI-College-Jobs', 'README.md', 'speedyapply', '1', 'main', true, 'none-declared',
   'Listings from speedyapply/2027-AI-College-Jobs (SpeedyApply). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.'),
  ('ApplyGuy', '2027-Internships', 'README.md', 'applyguy', '1', 'main', true, 'MIT',
   'Listings from ApplyGuy/2027-Internships (Apply Guy), MIT License, Copyright (c) 2026 Apply Guy.'),
  ('sndsh404', 'summer-2027-internships', 'README.md', 'slashpipe', '1', 'main', true, 'MIT',
   'Listings from sndsh404/summer-2027-internships, MIT License, Copyright (c) 2026 Sandesh Bhandari.'),
  ('negarprh', 'Canadian-Tech-Internships-2027', 'README.md', 'slashpipe', '1', 'main', true, 'none-declared',
   'Listings from negarprh/Canadian-Tech-Internships-2027. The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.')
on conflict (repo_owner, repo_name, path, adapter_id) do nothing;
