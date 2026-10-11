-- Source configuration rows (mirror of src/lib/discovery/sources.ts). The runner resolves the default branch via the GitHub API;
-- default_branch here is informational (both repos use `dev`, checked 2026-10).
insert into public.job_sources (repo_owner, repo_name, path, adapter_id, adapter_version, default_branch, enabled, license, attribution)
values
  ('SimplifyJobs', 'Summer2027-Internships', 'README.md', 'simplify', '1', 'dev', true, 'none-declared',
   'Listings from SimplifyJobs/Summer2027-Internships (Pitt CSC & Simplify). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.'),
  ('vanshb03', 'Summer2027-Internships', 'README.md', 'vansh', '1', 'dev', true, 'MIT',
   'Listings from vanshb03/Summer2027-Internships (Vansh & CSCareers), MIT License, Copyright (c) 2025 Vansh Bataviya.')
on conflict (repo_owner, repo_name, path, adapter_id) do nothing;
