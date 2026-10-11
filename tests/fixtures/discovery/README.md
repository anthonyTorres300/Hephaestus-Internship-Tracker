# Discovery fixtures

Trimmed excerpts used by the adapter unit tests (no network). Rows were sampled non-contiguously, so a `↳` continuation row may attach to a different company here than it does upstream.

| File | Upstream | Commit | License / attribution |
| --- | --- | --- | --- |
| `simplify-readme.md` | SimplifyJobs/Summer2027-Internships, `README.md` (default branch `dev`) | `17eeeb44a5e92ad5bc2a4dde7034cb0d5a22ab8c` (2026-10-11) | No license declared by the repository (GitHub API reports none; no LICENSE file). Only short factual excerpts are kept for tests; credit Pitt CSC & Simplify. |
| `vansh-readme.md` | vanshb03/Summer2027-Internships, `README.md` (default branch `dev`) | `609cac4e49c775f77cd419c76026251a4b62163b` (2026-08-23) | MIT License, Copyright (c) 2025 Vansh Bataviya. |

Real format notes: Simplify uses one HTML `<table>` per category section (Company, Role, Location, Application, Age) with `↳` continuation rows, `<details>` multi-location cells and `<br>` separators. Vansh uses one GitHub pipe table (Company, Role, Location, Application/Link, Date Posted) with inline HTML, `</br>` separators and a `🔒` in the Application cell for closed rows.

Synthetic rows (not upstream, added to exercise failure paths): Simplify — the `Moog` closed row (copied from the format of `README-Inactive.md`), `Broken Co` (wrong cell count), `NoLink Inc` (unsafe `javascript:` link), and the `New Grad Roles` section. Vansh — `Broken Row` (wrong cell count) and `Mallory` (new-grad title).

## Additional sources (adapters `speedyapply`, `applyguy`, `slashpipe`)

Trimmed from the live READMEs on 2026-10-11 (non-contiguous samples; `↳` continuation rows may attach to a different company than upstream). All repos are public with default branch `main`.

| File | Upstream | Commit | License / attribution |
| --- | --- | --- | --- |
| `speedyapply-readme.md` | speedyapply/2027-SWE-College-Jobs, `README.md` | `10cf3a15c3dbd559535c9d991a6151d1e369227e` | No license declared (GitHub API reports none; no LICENSE file). Short factual excerpts only; credit SpeedyApply. |
| `speedyapply-ai-readme.md` | speedyapply/2027-AI-College-Jobs, `README.md` | `3448676f5358c6af5fb83232a0094407ace363c4` | No license declared. Short factual excerpts only. |
| `applyguy-readme.md` | ApplyGuy/2027-Internships, `README.md` | `beb05ced5dc93071cf98ca7c22cb95189b195ec2` | MIT License, Copyright (c) 2026 Apply Guy. |
| `sndsh404-readme.md` | sndsh404/summer-2027-internships, `README.md` | `f2d77c85c3f847c0b9ca221e21a8fbd1c10e7599` | MIT License, Copyright (c) 2026 Sandesh Bhandari. |
| `negarprh-readme.md` | negarprh/Canadian-Tech-Internships-2027, `README.md` | `aebed25e54bcfda814e0323a9e6a6e545829ecb5` | No license declared. Short factual excerpts only. |

Format notes: speedyapply uses pipe tables per category (`### FAANG+`, `Quant`, `Other`) with HTML cells, a hidden-location-count suffix (`Seattle, WA +2`) and a relative Age; its new-grad and international lists live in other files. ApplyGuy has an `applyguy.ai` redirect and an original-listing markdown badge link in one Actions cell plus a Season column. sndsh404 and negarprh use `/`-separated locations; negarprh uses markdown badge links, `Mon D, YYYY` dates and `Closed🔒` instead of a link; sndsh404 has side tables (programs) and `🔒`/`⏳` markers.

Synthetic rows (not upstream): `Broken Co` / `Broken Row` (wrong cell count) in every file, and `Mallory` (new-grad title) in `speedyapply-readme.md`.

## Additional lists (adapters `aprameyak`, `jobbie`, `resumax`, `zshah`, `jobright`)

Trimmed from the live files on 2026-10-11 (non-contiguous samples, at most 40 table rows each; `↳` continuation rows may attach to a different company than upstream). Real data: licensed rows keep only short excerpts.

| File | Upstream | Commit | License / attribution |
| --- | --- | --- | --- |
| `aprameyak-summer-readme.md` | aprameyak/2027-tech-jobs, `SUMMER.md` (default branch `main`) | `a6026bdd5d6c0efd1051141cac81d3b075063857` | MIT License, Copyright (c) 2026 Aprameya Kannan. |
| `aprameyak-offcycle-readme.md` | aprameyak/2027-tech-jobs, `OFFCYCLE.md` | `a6026bdd5d6c0efd1051141cac81d3b075063857` | MIT License (same repository). |
| `jobbie-readme.md` | jobbie-bot/Summer-2027-Tech-Internships, `README.md` (`main`) | `dfcfd0eb5fd622d9425fc559e059d8e8c9cf3b7e` | MIT License, Copyright (c) 2026 Jobbie. |
| `resumax-readme.md` | resumax/tech-internships, `README.md` (`main`) | `d6c677eacd5671c060f6c68b9f322916ae566e09` | MIT License, Copyright (c) 2026 ResuMax. |
| `zshah-readme.md` | zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships, `README.md` (`main`) | `7d72d0695f47b80b3e1f35a0817fc3e3d083f3e7` | MIT License, Copyright (c) 2026 Shah Zain. |
| `jobright-readme.md` | jobright-ai/2026-Software-Engineer-Internship, `README.md` (default branch `master`) | `550ffe711bf8c952426021f3690f8ed8f11a6bf7` | No license declared (GitHub API reports none). Short factual excerpts only; credit Jobright.ai. |

Format notes: aprameyak has one pipe table between `TABLE_START`/`TABLE_END` markers with an Education column (`Masters; PhD`) and, in OFFCYCLE, a `Season / Term` column. jobbie's Link column is the employer/ATS URL (the last column is a referral button, ignored) and titles carry a pay suffix. resumax uses `:--:` alignment separators, decorative glyphs and `;`-separated locations. zshah has one table per cycle section (counts in headings, `(N openings)` suffixes, zero-width characters) plus unrelated tables. jobright has only a `jobright.ai` redirect per job (title link) and an employer homepage in the company cell; Work Model is a separate column.

Synthetic rows (not upstream): `Broken Co` / `Broken Row` (wrong cell count) in each file, `Mallory` (new-grad title) in aprameyak/jobbie/resumax/jobright, `Closed Co` (🔒) in `aprameyak-summer-readme.md`, `NoLink Inc` (no link) in `jobright-readme.md`, and the aprameyak `Tower Research` continuation row.

### Redirector-only lists (jobright)

The only per-job link is the list's own `jobright.ai/jobs/info/<id>` redirect. It is stored as `apply_url` with `link_kind: "source_redirect"` in the observation snapshot (query string dropped), `identity_key`/`canonical_url`/ATS fields are null, and it is never offered as an employer URL. Identity comes from the company+title+location+season candidate key; when it matches a job from another source the ingest RPC records a merge candidate for admin review instead of merging automatically.
