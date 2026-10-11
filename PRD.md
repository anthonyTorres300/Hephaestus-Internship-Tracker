# Internship Command Center — Product Requirements Document

**Audience:** Claude Code and the project owner, Anthony Torres  
**Version:** 1.1 — October 10, 2026  
**Target:** Publicly available, responsive multi-user website with private internship and interview-preparation workspaces  
**Status:** Implementation specification; no application has been built or deployed by this document.

## 1. Product decision and goals

Build one Next.js application using App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Postgres/Auth/Storage, Vercel, and GitHub Actions. Use Next.js server components, server actions, and route handlers for the web backend. Do not use Streamlit or a separate FastAPI service in the MVP.

The website must help students spend more time applying and preparing and less time managing spreadsheets. Anthony is the initial pilot user; public users receive the same capabilities with their own facts and preferences. It must:

1. Maintain an accurate application record with deadlines, follow-ups, notes, and status history.
2. Surface personalized opportunities from the shared Summer 2027 catalog with provenance, uncertainty, and duplicate protection.
3. Track manual LeetCode practice and expose DSA topics needing attention.
4. Store immutable resume versions and record which version accompanied each application.
5. Import each user's existing application log without silently changing facts or losing historical records.
6. Work from a laptop or phone through a deployed URL, with discovery running independently of user devices.
7. Support public signup, email verification, personal onboarding and isolated workspaces.
8. Refresh the shared job catalog once for everyone, with administrator-only source controls.

Success means all reviewed source rows can be accounted for after import, repeat imports and discovery runs do not create exact duplicates, private data is isolated by database policies, and ordinary application/practice entry takes approximately one minute after onboarding. The time target is a usability goal, not a measured result. The app cannot promise interviews or offers.

## 2. Owner profile, personas, and evidence

### 2.1 Primary persona: Anthony

- Software Engineering student, University of Puerto Rico at Mayagüez; expected graduation May 2029.
- Based in Puerto Rico; authorized to work in the United States without employer sponsorship, per project instructions.
- Seeking Summer 2027 SWE, backend, cloud, data engineering, AI/ML, and autonomous systems internships, primarily in the United States.
- Current Digital Technology Co-op at Collins Aerospace/RTX; previous Full-Stack Developer Intern at Wovenware.
- Needs fast daily entry, trustworthy discovery, interview preparation visibility, and access across devices.

Additional personas:

- **Student user:** Any registered student manages their own applications, resumes, practice and profile. Graduation dates, sponsorship needs, locations and skills vary by user.
- **Returning user:** Reviews weekly progress, imports their own log and changes preferences without affecting others.
- **Administrator:** Manages configured discovery sources, catalog duplicate review, operational health, capacity and account suspension. Administrator status does not grant access to another user's resumes, notes, applications or practice.

Anyone may register subject to published service terms and abuse controls. Initial discovery coverage remains the configured Summer 2027 GitHub lists; registration does not guarantee opportunities for every country, season or role. Team workspaces, recruiter portals and social profiles remain outside MVP.

### 2.2 Private pilot evidence and how to use it

| Material | Evidence and implementation consequence |
| --- | --- |
| [The Internships Docs](https://docs.google.com/document/d/1q3djk28c9GqCQe_s2NO3ZPXU6YpL2KCRHhxzj5yGkAk/edit) | Existing seven-column application table; contains 2024–2026 application dates, 2025/2026/2027 roles, repeated companies, shared candidate portal links, blank cells, and status variants. Retain all historical seasons and use previewed import mapping. |
| [Anthony Torres - Resume.docx, October 2, 2026](https://docs.google.com/document/d/17efSn4Klgg8VA9ziCkbHnW68r2uVAInE/edit) | May 2029 graduation; overall GPA 3.24 and major GPA 3.77; Python, C++, Java, C#, Oracle SQL, HTML/CSS, JavaScript, MATLAB; Spring Boot, Vue.js, Docker, GCP, GitHub Actions, ROS 2 and Gazebo. Use user-confirmed profile skills for relevance scoring, not invented expertise. |
| Local `application-review-pinterest.md` and `application-review-pdt.md` | Both state "Prepared; not submitted." They are review drafts, not proof of applications. If added, use `prepared`, no submission date, and exclude from submitted counts. |
| Project `AGENTS.md` and supplied conversation preview | Career priorities and fixed stack; preserve all synced project references. The local `sources/` directory was empty when inspected. |

The resume describes Python automation for 14,800+ files and 100,000+ rows, Oracle SQL/PLM audits, Wovenware REST/relational work, LiDRON autonomous systems research, and a shipped Unity/C# game. An 80% manual-overhead reduction is a **target**, not a completed result. These facts inform optional profile skills and future tailoring; do not publish private resume content or prepopulate resume claims from guesses.

Multiple resume files exist in Drive. Treat the October 2 DOCX as the referenced baseline, retain its provenance, and let Anthony explicitly designate the master version. Do not select a master solely by latest modification time. Do not assume access to these private links in Claude Code: the owner will supply exports locally when importing. Creating this PRD does not migrate the records or modify the Drive files.

The log includes HPE screening entries, an RTX offer, and entries titled Early Career/Software Engineer I. Preserve them even when they fall outside current internship discovery filters. Repeated Lockheed entries with the same title/date/portal may be distinct applications; flag rather than merge automatically.

Anthony's facts and private references are pilot evidence only. Do not include this private PRD, resume links, personal profile or application records in a public repository, landing page, onboarding defaults or demo. Produce sanitized public documentation with synthetic examples. Public users begin with empty workspaces. In this document, "owner" on a private record means that record's user, not a platform-wide privileged account.

## 3. Scope and priority

### 3.1 Required MVP

| ID | Capability |
| --- | --- |
| AUTH | Public signup, email verification, login/logout, password recovery, protected pages, server verification and per-user RLS. |
| ONBOARD | Per-user education, graduation month/year, authorization, sponsorship, geography, skills, goals and timezone. |
| ADMIN | Restricted shared-source controls, catalog review, refresh operations, suspension and safe operational metrics. |
| PUBLIC | Landing page, privacy/terms, account export/deletion, quotas and abuse/cost controls. |
| APP | Application CRUD, archival/trash, status timeline, notes, deadlines, interviews, follow-ups, search/filter/sort, resume association. |
| IMPORT | CSV/TSV import with seven-column mapping, preview, validation, ambiguity review, repeat-import protection, export. |
| JOB | Two configured public GitHub list adapters, scheduled/manual refresh, provenance, freshness, dedupe, eligibility assessment, save/hide/application linkage. |
| DSA | Manual problem catalog and attempts, topic tags, review dates, difficulty and topic analytics. |
| RESUME | Private PDF/DOCX uploads, version metadata, default version, download, link to applications. |
| DASH | Application and practice charts, due actions, discovery health, explicit empty/error states. |
| OPS | Migrations, automated tests, reproducible local setup, deployment instructions, secret isolation and job diagnostics. |

All are release requirements, although phases deliver them incrementally. Start with application tracking and import before discovery or charts. Use a closed pilot before public registration; the architecture is multi-user from the foundation.

### 3.2 Outside MVP

- Automated employer application submission, CAPTCHA bypass, employer login automation, or resume forwarding.
- Arbitrary career-site scraping, comprehensive job coverage, guaranteed live availability, or a guaranteed LeetCode API.
- LeetCode credentials, session-cookie collection, browser extensions, or automatic submission synchronization.
- AI resume tailoring, generated cover letters, ATS score claims, embeddings/vector search, or paid model dependencies.
- Gmail, Google Calendar, or Google Drive OAuth integrations and automatic bidirectional sync.
- Email/push/SMS reminders, scheduled outreach, shared/team workspaces, public user profiles, native desktop/mobile apps, and billing. Authentication verification/recovery email is required and is not a reminder integration.
- Separate Python service, microservices, Kubernetes, or a general workflow engine.

Follow-ups and deadlines are visible in the app; they do not send messages in MVP. CSV import is the bridge from the existing Google Doc. PDF/DOCX parsing is not needed for resume storage.

## 4. Application tracking requirements

### 4.1 Record and CRUD

Require company and role title. Store optional linked job, employer requisition ID, application URL, candidate portal URL, locations, work mode, role category, target season/year, priority (`high`, `medium`, `low`), submission date and precision, current status, contact/channel, resume version, and archive/trash timestamps. Keep job application links separate from progress portal links.

- Create manually or from a discovered job. Saving a job does not create a submitted application.
- Supported statuses: `saved`, `prepared`, `applied`, `screening`, `assessment`, `interview`, `offer`, `accepted`, `rejected`, `withdrawn`, `ghosted`.
- `applied` and later pipeline stages require either a user-entered submission date or an explicit "submission date unknown" flag. `saved`/`prepared` must not have a submission date. Imported partial dates are allowed with precision metadata.
- Entering a submission status requires user attestation that they submitted; opening an external link never changes status.
- Initial creation writes a timeline event. Every subsequent status change writes old/new status, effective time, recorded time, origin and optional reason atomically with the current status update.
- Allow corrections/reopening with a reason. No rigid linear workflow: assessment and screening can occur in different orders. Same-status edits do not create redundant status events.
- Do not invent historical transitions from a current imported status. Import one initial snapshot event, labeling its historic effective time unknown when appropriate.
- Notes are separate timestamped records, editable with updated time. Notes support plain text or safely rendered restricted Markdown; no raw HTML.
- Interview events support multiple rounds, time/timezone, round type, outcome and notes.
- Deleting moves to trash; restoring reverses it. Explicit permanent deletion removes child notes/events/reminders, updates derived charts, and is confirmed in the UI. Archive hides records from active views but preserves analytics when the selected cohort includes them.
- Paginate server-side, default 25 rows; filters and sorting live in URL query parameters. Search company/title, filter status, season, location, priority, and submitted date. The current-season view must have an obvious "All history" option.

### 4.2 Deadlines and follow-ups

Application tasks have kind (`application_deadline`, `follow_up`, `offer_deadline`, `review`), optional application/job reference, due date or due timestamp, source, note, state (`pending`, `completed`, `dismissed`) and completion time. Dates and timed events are distinct; date-only deadlines never receive an invented midnight cutoff.

Use the user's confirmed IANA timezone; suggest the browser timezone during onboarding and use UTC until confirmed. Anthony's pilot profile uses `America/Puerto_Rico`. Display overdue tasks first, then today and next seven days. A date-only task becomes overdue the day after its due date in the profile timezone; a timed task becomes overdue after its exact instant. Permit snooze by changing due time and retaining an audit event. Unknown deadlines remain blank. Source claims and user-entered deadlines show their provenance. Completion is idempotent; no automatic email is sent.

## 5. Job discovery, freshness, and deduplication

### 5.1 Sources and adapters

Start with these public repositories, checked during PRD preparation:

- [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships).
- [vanshb03/Summer2027-Internships](https://github.com/vanshb03/Summer2027-Internships), also linked in the existing log.

These repositories can include categories/seasons outside the target. Parse season/category explicitly; never infer every row is Summer 2027 solely from the repository name. Exclude new-grad lists from the default discovery feed, including the new-grad resources in the historical log.

Maintain checked-in source configuration: repository owner/name, permitted paths, discovered default branch, adapter ID/version, enabled flag and attribution/license information. Resolve repository metadata through GitHub's API; do not hardcode `main` because branch names differ. Inspect source formats and reuse structured public data when suitable; otherwise parse Markdown tables using a Markdown parser and source-specific rules. Handle continuation-company rows, multiple links, HTML badges, closed markers and multi-location cells. Do not execute repository code or source HTML. Inspect each repository's license/terms before redistribution; retain attribution and avoid storing unrelated repository material.

Normalized record: company, title, role category, season/year, locations/country/work mode, original/canonical application URL, ATS namespace and requisition ID if extractable, source listing date with precision, source state, raw row reference, eligibility evidence, and content hash. Store repository, path, commit SHA, section/row identifier, GitHub permalink and ingestion time for each observation. A malformed row is quarantined with a safe diagnostic; one adapter failure must not erase other sources' records.

### 5.2 Freshness and availability

- Distinguish `source_posted_at`, `first_seen_at`, `last_seen_at`, `last_successful_refresh_at`, and `employer_verified_at`. A first observation is not the employer's posting date.
- Label newly discovered jobs by first-seen time; label source posting dates separately. Default sort is newest first-seen, optionally source date when available.
- Availability values: `listed`, `source_closed`, `missing_from_source`, `employer_verified_open`, `employer_verified_closed`, `unknown`.
- MVP automated ingestion establishes only list status. Employer verification is manual, recording URL, evidence note and timestamp. A successful HTTP response alone cannot establish an open role.
- Show "Listed on GitHub; employer availability unverified" for default source-only rows.
- Flag feed health stale after 48 hours without a successful source refresh. Mark old manual employer verification stale after seven days; display its timestamp rather than claiming current availability.
- Only after two successful full snapshots for a source at least 24 hours apart may a missing listing be marked missing from that source. Parse failures, incomplete fetches, outages and anomalous empty feeds never mark jobs missing/closed. A job still present in another source remains listed there.
- An explicit closed marker changes only that observation's source state. Preserve conflicting evidence and show it. Never delete application data when a job disappears.
- Treat fewer than 50% of the last accepted snapshot's rows as suspicious; hold that snapshot for operator review before missing-record reconciliation. First-run empty output is a failure requiring inspection.

### 5.3 Identity and duplicate rules

1. Prefer a unique ATS namespace + employer namespace + requisition ID. Different employer tenants must not share identity accidentally.
2. Otherwise match safely canonicalized application URLs. Strip only known tracking parameters (`utm_*`, `ref` when known to be tracking); preserve job-identifying query parameters. Do not collapse candidate dashboards/userHome URLs into job identities.
3. Otherwise use company + normalized title + locations + season/year as a **candidate match**, requiring review when identity is uncertain.

Exact identities upsert one `jobs` record with multiple source observations. Similar roles, different IDs, locations or seasons stay separate by default. Never merge all roles at one company. Version normalization rules and store originals. Provide administrator review for shared-catalog duplicates; job merge resolves saved/hidden state independently for each user, moves observations safely and leaves application snapshots unchanged. Users review duplicates only in their own application imports. Applied exclusion uses linked job IDs or confirmed exact identity; uncertain title matches display "Possible previous application" instead of hiding a new job. Historical Summer 2026 applications must not suppress Summer 2027 roles.

### 5.4 Feed actions

Each card/row shows company, role, location, season, estimated match score, priority, eligibility result and reasons, availability label, first-seen/source dates, direct application link and provenance link. Actions: save, hide, open employer link, mark employer verification, and create application. Hide applied and dismissed roles by default with an explicit toggle. Saved/hide actions are private user state, not mutations of the global catalog.

## 6. Eligibility and transparent ranking

Public users start with unknown education, graduation date, work authorization, sponsorship, citizenship, export-control US-person status and clearance eligibility, and no confirmed skills. Onboarding collects each user's own facts, preferences, willingness to relocate and target season. Never default a new user to May 2029 graduation, US work authorization or no sponsorship. Anthony's optional pilot profile is bachelor's, May 2029 graduation, US work authorized `true`, sponsorship required `false`, Summer 2027 and United States including Puerto Rico, saved only in his workspace after confirmation. Unknown facts remain unknown; authorization does not establish citizenship or export-control status.

Eligibility is `eligible`, `ineligible`, or `needs_review`, with per-rule reasons and evidence URL/text/date. Here, eligible means **matches recorded requirements**, not an employer decision. Missing or ambiguous requirements yield needs_review. Graduation constraints are checked against an inclusive month interval; do not invent a day in May. Exclude from the default feed only explicit contradictions, such as a required graduation interval ending in 2028. An employer that offers sponsorship is not a reason to exclude someone who needs none. Flag roles specifically requiring a different visa/student program. Hard citizenship/clearance requirements remain needs_review until the relevant profile fact is known.

Other filters: bachelor's/undergraduate versus graduate-only; technical category; target season; US location and explicit remote jurisdiction restrictions. Unknown season/location goes to a review filter. Remote does not mean available from Puerto Rico. Requirements not present in a GitHub row are unknown; do not claim a comprehensive eligibility assessment without employer evidence. Store manually entered structured constraints separately from source facts and recompute when the profile or evidence changes.

**Deterministic score v1, shown as "Estimated relevance: N/100":**

| Component | Maximum | Rule |
| --- | ---: | --- |
| Role interest | 30 | 30 for user-selected categories; 15 adjacent technical roles; 0 unrelated. |
| Skills | 25 | Fraction of explicitly recorded skill requirements matched by confirmed profile skills; unknown requirements earn 0 with an insufficient-data explanation. |
| Graduation/degree | 20 | 20 when both known constraints match; 10 when one matches and the other is unknown; 0 for no confirmed match. |
| Location | 15 | 15 for confirmed compatible preference; 8 for US location needing relocation review; 0 unknown/incompatible. |
| Recency | 10 | Source listing date, otherwise first seen: 10 within 7 days, 5 within 30 days, 0 older; label first-seen basis. |

Explicit ineligibility overrides priority to Low regardless of score. Otherwise High requires score ≥75, no known conflicts, and no unresolved critical eligibility rule; Medium requires ≥50 or strong role interest with critical unknowns; Low otherwise. Keep unknown requirements visible rather than forcing eligibility. Score is not interview probability or ATS compatibility; show component breakdown, missing evidence and scoring version. Preferred companies can be filtered/starred but do not create unsupported qualification claims.

## 7. Manual LeetCode and DSA tracking

Problem catalog fields: platform (`leetcode` initially), optional platform ID, canonical URL/slug, title, difficulty (`easy`, `medium`, `hard`, `unknown`) and many-to-many DSA topics. Attempts reference a problem and store practice timestamp, duration minutes, language (user preference; Python is an editable initial suggestion), result (`solved_independently`, `solved_with_hints`, `reviewed_solution`, `unsolved`), confidence 1–5, notes, and optional next-review date. Revisiting a problem creates an attempt rather than increasing the distinct problem count. Duration must be 0–240 or explicitly unknown; flag unusually large entries for confirmation instead of silently truncating.

Seed topics: arrays/hash maps, two pointers, sliding window, stacks/queues, binary search, linked lists, trees/BST, heaps, graphs, recursion/backtracking, dynamic programming, greedy, intervals, bit manipulation, and math. Permit topic edits. Manual entry must work with just title, result and practice date; topic/difficulty can be completed later. Do not seed fabricated completed problems.

Analytics: distinct problems practiced; distinct independently solved; attempts per week; difficulty mix; topic attempts; independent-solve rate per topic; average confidence; due reviews; weak-topic suggestions. Define independent-solve rate as independent attempts / all logged attempts in the selected period. A multi-topic attempt contributes to each topic; explain that topic counts are not additive. Display rates as counts too and label samples under five attempts "limited data." Recommend review where at least five attempts have independent-solve rate <50% or average confidence <3; show unpracticed topics separately without calling them proven weaknesses. Streak counts consecutive local calendar days with any attempt, ending today or yesterday; timezone comes from the user's confirmed profile, not a global Puerto Rico default.

There is no dependency on an official LeetCode API. Later integrations require documented permission, stable interfaces and fallback to manual entry. Do not request LeetCode passwords or session cookies.

## 8. Resume versions and future tailoring

Upload PDF and DOCX only, maximum 10 MB per file, to a private Supabase Storage bucket. Record UUID, owner, original filename, MIME type, size, SHA-256, storage path, human label, upload time, source date/link, version number, optional role/company tag and notes. Files are immutable: replacement creates a new version. Allow one default resume per owner. Same checksum prompts reuse but does not silently replace metadata. Reject executable/disguised files; verify extension, MIME and expected file signature/container type server-side. No macro-enabled formats.

Download uses a short-lived signed URL after owner authorization. Preview PDFs only when safe; DOCX can be downloaded without conversion. Applications retain the exact resume version association. Deleting a linked version is blocked until associations are explicitly cleared; default-pointer cleanup and storage cleanup must be consistent and retryable. Never use public bucket URLs. Original files are preserved without alteration.

Later tailoring must use an owner-designated master and employer job description, separate facts from inferred fit, keep proposed changes reviewable, preserve supported metrics and technologies, and produce a new version. It must never treat a target metric as an achieved result or apply a tailored resume automatically. No tailoring engine or AI credentials in MVP.

## 9. Existing log import and export

### 9.1 MVP input contract

Support UTF-8 CSV and TSV, pasted TSV as an alternative, 5 MB / 5,000 rows maximum. Export the table from the Google Doc or paste table cells into a spreadsheet and save CSV. Native Google Doc parsing/sync is later work. Supply a template with these original headers and a richer app-native export format. CSV quoting, commas inside titles, newlines, BOM, blanks and trailing empty rows must work.

| Original column | Target mapping |
| --- | --- |
| Company Name | `company_name`; required except wholly blank rows. |
| Position Applied For | `role_title`; required. |
| Application Date | original string + date precision + normalized date when unambiguous. |
| Status | canonical status + original status text. |
| Interview Date | optional interview event, with raw date and precision preserved. |
| Offer Received | optional received date if a recognizable date; yes/no is a flag requiring review, not a date. |
| To Check Progress | progress channel text and optional candidate portal URL; never automatically application URL. |

Status mappings: Pending → applied; SCREENING PROCESS → screening; Offer Received → offer; Not Proceeding → rejected with "imported source label" reason; Ghosted → ghosted. Show all mappings for confirmation. Unknown labels require mapping/skip. "Not Proceeding" can be ambiguous; the owner can change it to withdrawn or another status during preview. Preserve source labels regardless.

### 9.2 Dates, seasons, and anomalies

- Parse named months and observed formats such as `Aug.26.25`, `Aug. 6. 26`, `Oct 8.25`, and `Mar.24.26` through explicit format rules. Interpret a two-digit year as 2000–2099 for this importer and display that rule. Reject ambiguous numeric dates for review.
- `Sept. 2024` is month precision: retain year/month and display September 2024; do not present September 1 as the actual application date.
- Keep suspicious values such as `Jan.21.25` for review; never "fix" their year from neighboring entries.
- Blank dates stay unknown, blank offer cells are unknown rather than false, and blank interview dates create no event.
- A role's season is inferred only from explicit title/source evidence or owner confirmation, never from application year alone. Winter, co-op and early-career rows remain intact with appropriate category or unknown target season.
- Candidate portal URLs can recur across unrelated applications; preserve them without deduplicating on them.

### 9.3 Preview and commit

1. Parse to staging rows; display totals, original values, proposed values, warnings and errors.
2. Let the owner edit mappings and resolve ambiguous dates/statuses/possible duplicates. Default commit is disabled until each invalid row is corrected or explicitly skipped.
3. Deduplicate repeat files using file checksum and per-batch row identity (source row ordinal + raw-row fingerprint); identical repeated source rows are retained as separate rows pending review. Across changed files, exact owner-confirmed application identity or a user decision is required for matching; company/title/date alone is a warning, not an automatic merge.
4. Commit accepted rows in a transaction and attach one import-snapshot event per application. Retried commit of the same batch returns the same result. Persist row decisions and created/linked IDs. Import commit never overwrites existing applications silently.
5. Show created/linked/skipped/failed counts whose sum equals nonblank input rows, with downloadable error report. Allow undo by trashing only unchanged records created by that batch; edited records and preexisting linked records require review and are not automatically removed.

Provide application CSV export and full owner JSON export for portability. CSV exports escape spreadsheet formula prefixes (`=`, `+`, `-`, `@`, including leading control/whitespace cases); JSON retains exact text. Export all history on request, including original import values and date precision. No private source data in production seeds, fixtures, or GitHub artifacts; use synthetic lookalikes for tests.

## 10. UX and pages

| Route | Purpose |
| --- | --- |
| `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/auth/callback` | Registration, verification, login, recovery and safe callbacks. |
| `/` | Public landing page with accurate coverage/features and signup/login links; no private records. |
| `/onboarding` | Personal profile setup with unknown/skip options. |
| `/privacy`, `/terms` | Public policy pages reflecting actual data handling and service rules. |
| `/dashboard` | Submitted applications, current pipeline, upcoming tasks, weekly practice, new jobs and source health. |
| `/applications` | Searchable table, mobile cards, filters, add/import/export actions. |
| `/applications/new`, `/applications/[id]` | Application form/detail, timeline, notes, interviews, tasks and resume association. |
| `/jobs`, `/jobs/[id]` | Discovery feed/details, evidence, estimated relevance, save/hide/create application. |
| `/practice` | Manual attempt entry, history, review queue and topic/difficulty charts. |
| `/resumes` | Version upload, labels, default selection and protected download. |
| `/import` | Mapping, preview, review, commit and past batch results. |
| `/settings` | Confirm profile, timezone, skills, goals, location/eligibility facts and export. |
| `/admin/sources`, `/admin/runs`, `/admin/users` | Administrator-only configured sources, diagnostics and suspension; no private workspace browser. |
| `/settings/account` | Own export, usage/quota display, security settings and self-service account deletion. |

Use a consistent sidebar on desktop and accessible compact navigation on mobile. Primary actions should be visible without nested menus. Forms preserve input after errors; empty states explain the next action. Status is text plus color, never color alone. Keyboard support, labeled controls, focus management, accessible dialogs, charts with text/table equivalents, and WCAG 2.2 AA-oriented contrast are required. Test widths 375, 768 and 1440 pixels. Do not display a whole dashboard as one overflowing mobile table.

Charts use Recharts as a recommended rendering library. Pages loading private data are dynamically rendered and must not be shared-cacheable. Separate source-feed cache from personalized state. Use skeletons for loading, explicit retry for errors, and distinguish zero values from missing data. Store timestamps in UTC and display using profile timezone; date-only fields remain date-only.

## 11. Dashboard definitions

- Submitted count: nontrashed records with submitted status/date-unknown attestation, within selected season/cohort; saved/prepared excluded. Historical import records with partial dates remain countable but clearly labeled.
- Pipeline chart: current-status counts, not invented sequential conversion. Interviews/offers metrics count distinct applications with recorded evidence/events; the initial import snapshot supports only its known status, not a complete pipeline history.
- Weekly applications: submission dates grouped by local week starting Monday. Unknown/month-only dates appear in an "Unallocated dates" total rather than arbitrarily assigned to a week.
- Offer rate: applications with recorded offer evidence / submitted applications in the selected cohort; preserve recorded offer dates even if current status later becomes accepted/withdrawn. Label the denominator and incomplete imported history.
- Upcoming actions: overdue, today, next seven days, excluding completed/dismissed/trashed applications.
- Practice: attempts this week versus editable weekly goal, distinct independently solved problems, topic breakdown and due reviews. Do not label reviewed solutions as independently solved.
- Jobs: newly seen relevant jobs in seven days excluding confirmed applied/hidden records; show critical unknowns and last successful refresh.

Dashboard targets the user's selected season, with Summer 2027 as an editable initial suggestion and an explicit discovery-coverage label. Historical records of unknown season appear in an explicit unclassified filter with a count. Date ranges, filters and metric definitions must match exported results.

## 12. Architecture and repository layout

```text
Browser → Next.js on Vercel → Supabase Auth/Postgres/Storage
GitHub Actions → TypeScript source adapters → restricted ingestion RPC → Postgres
```

The web server uses the user's session and RLS for ordinary operations. Discovery runs in GitHub Actions, avoiding long Vercel function executions. It reads only configured public source paths and writes catalog/operational data through a narrowly scoped database identity. The app reads discovery results from Postgres; it does not refetch GitHub on every page visit. One shared ingestion run serves all users. Eligibility, scoring, applied exclusion, manual verification and saved/hidden state are personalized. Cache keys for personalized results include user ID, profile revision, filters and scoring version; private responses must never enter a user-agnostic cache.

```text
src/app/                  pages, server actions and route handlers
src/components/           reusable shadcn-based UI and charts
src/lib/supabase/         browser/server session clients
src/lib/auth/             verified user sessions and administrator authorization
src/lib/validation/       shared Zod input schemas
src/lib/domain/           status, dates, scoring, dedupe and analytics
src/lib/import/           CSV parser, mapping and staging
src/lib/discovery/        adapters, normalization and reconciliation
scripts/                  discovery runner and operator utilities
supabase/migrations/      schema, grants, RLS, RPCs and indexes
supabase/seed.sql          synthetic development data only
tests/                    unit, database integration and Playwright
.github/workflows/        CI and scheduled discovery
.env.example              placeholders and environment descriptions
```

Use a supported stable Next.js/Node combination at implementation time, verify official compatibility, pin dependency versions and commit a lockfile. Avoid unstable framework APIs. Tailwind/shadcn configuration must follow the installed versions. Required supporting libraries: Supabase JS/SSR, Zod, robust CSV and Markdown parsers, a timezone-aware date library, Vitest and Playwright. No unnecessary state-management framework or ORM is required; SQL migrations and typed Supabase clients suffice.

## 13. Data model and database contracts

UUID primary keys unless specified; UTC `timestamptz` for instants; created/updated timestamps on mutable tables. Every private row has `user_id` referencing `auth.users`. Client-supplied ownership is never trusted. Private child tables use composite `(parent_id,user_id)` foreign keys against unique `(id,user_id)` parent keys, preventing cross-owner attachment even if an ID is guessed. Enum/check constraints mirror validation. Preserve raw source/import values in bounded JSONB, not arbitrary executable content.

| Table | Key fields and relationships |
| --- | --- |
| `profiles` | PK `user_id`; university, degree, graduation year/month, timezone, work authorization/sponsorship/citizenship/US-person/clearance facts, preferred locations/categories, confirmed skills, weekly practice goal, target season/year, preferred language, onboarding state and profile revision; nullable unknown facts. |
| `account_states` | PK user ID; active/suspended/deletion_requested state. Server-managed, own safe-state read only; RLS eligibility checks state and verified email. |
| `user_roles` | Unique user/role (`admin`); trusted operator grants/revokes only, never profile-editable or client-writable. |
| `admin_audit_events` | Actor, action, target catalog/account ID, time and bounded safe metadata; immutable, admin-only read; no private document content. |
| `usage_counters` | User, quota type/window, committed and reserved usage, reservation expiry; trusted atomic updates and own read. |
| `account_deletion_requests` | User/request key, requested_at, state, cleanup checkpoints, retry count and safe error code; own safe progress read while account exists. |
| `policy_acceptances` | User, policy type/version, accepted_at; append-only verified acceptance for published signup terms, private own read. |
| `catalog_verifications` | Job, administrator actor, public evidence URL/note, verification state/time; shared read only after administrator review, never sourced from private user notes. |
| `jobs` | company/title/category, season/year, locations JSONB, work mode, original/canonical apply URL, stable identity nullable unique, ATS/employer/requisition, first/last seen, normalized requirements, deleted/superseded pointer if merged. |
| `job_sources` | unique repo/path/adapter; default branch, enabled, license/attribution, last success, ETag, accepted row count. Only administrators configure allowlisted sources; users cannot inject fetch endpoints. |
| `discovery_runs` | trigger, start/end, state, runner ID, safe aggregate counts/error code. |
| `source_runs` | discovery/source IDs, state, commit SHA, payload hash, completeness, row counts, last accepted baseline, diagnostics. |
| `job_observations` | job/source/run IDs, stable source entry key, permalink, row hash, normalized snapshot, observed state, listing date precision, first/last seen, missing count. Unique `(source_id,entry_key)` for current observation. |
| `job_observation_events` | immutable observation/run snapshot, evidence and effective observation time; preserves changes. |
| `user_jobs` | unique `(user_id,job_id)`; saved/hidden state, manual employer-verification state/evidence/time, score cache/version/profile hash if used. |
| `applications` | owner, optional job FK, company/title snapshot, URLs, category, season/year, priority, current status, submitted date parts/precision/unknown attestation, original status, confirmed identity nullable, resume FK, import batch FK, archived/trashed time, revision integer. |
| `application_status_events` | owner/application, old/new status, effective time nullable, recorded time, origin, reason, idempotency key; append-only. |
| `application_notes` | owner/application, body and edit timestamps. |
| `interview_events` | owner/application, date parts or timestamp, timezone, precision, round/outcome/notes, raw imported date. |
| `offer_events` | owner/application, received date parts/precision, unknown-date flag, raw source value; offer existence survives later status changes. |
| `tasks` | owner, optional application/job FK, kind, date XOR timestamp, timezone, state, source/evidence, note, completed time. |
| `task_events` | owner/task, action, old/new due value/state and recorded time. |
| `resume_versions` | owner, unique owner/version number, label, storage path unique, original filename, MIME/size/hash, source link/date, role tags, state (`pending_upload`, `ready`, `delete_pending`, `failed`). |
| `resume_defaults` | PK owner, owner-checked ready resume FK; avoids circular profile/resume dependency. |
| `practice_problems` | owner, platform/title/URL/optional platform ID, difficulty; unique owner/platform/canonical slug when known. |
| `dsa_topics` | stable slug/title taxonomy; global read-only seeds. |
| `problem_topics` | owner/problem/topic join, composite PK; ownership follows problem. |
| `practice_attempts` | owner/problem, practiced_at, duration, language/result/confidence, notes, next_review_date. |
| `import_batches` | owner, file hash/name, mapping version, state, created/committed time, summary; unique owner/file hash/mapping version unless explicit new review batch. |
| `import_rows` | owner/batch/ordinal, raw values, proposed normalized values, row fingerprint, decision/errors, created/linked application ID; unique batch/ordinal. |
| `operation_keys` | owner/scope/key unique, request hash and safe result IDs for retried mutations. |

All private unique keys, checksums, idempotency keys and duplicate matches are scoped to user ID; identical imports/resumes in two accounts never collide or reveal existence. Only shared job identities are global. Global admin roles/operational tables are not private-workspace tables and have separate narrow policies.

Date precision is `day`, `month`, `year`, `unknown`; use nullable year/month/day with check constraints for allowed combinations and valid calendar dates. Use this convention for imported submission, interview and offer dates. Do not substitute a full SQL date for a partial historical date.

Indexes: applications `(user_id,season_year,status)` and `(user_id,submitted_year,submitted_month)`, tasks `(user_id,state,due_date)` and due timestamp, notes/events `(application_id,recorded_at)`, attempts `(user_id,practiced_at)`, jobs identity/canonical URL, observations `(source_id,last_seen_at)`, and user_jobs `(user_id,job_id)`. Normalize/search company/title with bounded indexed text; add trigram search only if ordinary search is inadequate. Add FK indexes where needed.

Atomic RPCs: application creation/status change (with event), task completion/snooze, import commit, resume default switch, and source snapshot commit/reconciliation. Use optimistic concurrency via application revision; stale updates return conflict, never overwrite silently. Unique constraints plus request keys enforce retry behavior. Ingestion snapshot application must be atomic per source; independent sources may succeed separately. Do not allow clients to directly mutate status or delete history without the intended database operation. Define trusted triggers or column grants accordingly; UI conventions alone are insufficient.

## 14. Auth, RLS, and security

- Public release supports email/password signup, required email verification, login/logout, password recovery and optional magic links through Supabase Auth. Recovery/verification links expire and handle reuse safely. Require an active verified account before workspace access, upload or import; enforce the check server-side and in RLS. A closed-pilot deployment can temporarily restrict registration. Configure and test production verification/recovery mail delivery.
- Use `@supabase/ssr` cookie-based auth, with server verification according to the installed Supabase guidance. Protect every page, action, route, upload and signed-download request independently. Client-side hiding is not authorization. Validate callback return paths against a local allowlist to prevent open redirects.
- Enable RLS on every exposed table. Private SELECT/DELETE/UPDATE policies use `auth.uid() = user_id`; INSERT/UPDATE require equivalent `WITH CHECK`. Parent ownership must be enforced for all child FKs, not only tested in application code.
- Active verified users may read sanitized shared jobs, attribution and taxonomy. Source administration and detailed run diagnostics are administrator-only; normal users see a safe feed-health summary. Users cannot write catalog, run or source records. Their scoring/manual-verification state remains private and never promotes global job evidence.
- Replace the single-owner allowlist with per-user ownership and protected database administrator roles. Never trust client role fields or user-editable auth metadata. Trusted operators grant/revoke administrators. Check suspension/deletion state in RLS and server operations so existing sessions cannot bypass restrictions. An administrator role does not bypass private-workspace RLS.
- Status/event and import RPCs must validate owner and inputs. Prefer security-invoker functions; any security-definer function must have fixed `search_path`, narrow grants, explicit identity checks and tests. Revoke default PUBLIC execute grants from privileged functions.
- Private storage policies restrict paths to `<auth.uid()>/<resume-id>/<safe-name>` and operations to the owner; deny listing/downloading another owner's objects. Metadata ownership and storage authorization must both hold.
- Public Supabase publishable key is expected in browser code; secret/service-role/database credentials must never use `NEXT_PUBLIC_`, appear in logs or be delivered to clients. Service-role keys bypass RLS and must not be the normal web client.
- Discovery role receives only catalog-ingestion RPC privileges, not access to resumes, profiles, applications or private tables. Keep its database URL solely in Actions secrets. No privileged ingestion credentials in the Vercel application.
- Use schema validation, limits, safe URL schemes (`https` preferred; no `javascript:`), CSRF/origin defenses for cookie-authenticated mutations, auth/upload/import/manual-refresh rate limits, and sanitized text rendering. No raw HTML from lists or CSV. External links use safe new-tab attributes.
- Prevent SSRF: fetch configured GitHub host/repo/path only, enforce redirect host checks and time/size limits; never fetch an arbitrary pasted job URL automatically. Treat source Markdown and job descriptions as untrusted data, including future AI prompts.
- Do not log resume content, notes, full import rows, signed URLs, tokens or personal contact details. Logs contain IDs, counts and error codes. Disable public indexing of protected content. Private responses use appropriate no-store behavior.
- Each user can export or permanently delete their own data after recent reauthentication. Self-service account deletion is required: show progress/retry state, immediately block data access and revoke sessions, clean private rows/storage, then remove the Auth user. Storage and SQL cleanup is retryable through the narrow lifecycle worker in §22.

Security acceptance requires direct database/storage requests, not only browser UI tests. Reference [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) for policy behavior and [Supabase Next.js authentication guidance](https://supabase.com/docs/guides/auth/quickstarts/nextjs) for the supported setup.

## 15. API and automation design

Use server actions for ordinary form mutations and route handlers for imports/exports/files/operator triggers. Implement one shared validation/domain layer, not duplicate business logic in each transport.

| Contract | Behavior |
| --- | --- |
| `GET /api/applications` | Owner-filtered paginated search; optional public-to-app API only if needed by UI. |
| application actions | Create/edit/trash/restore; revision and idempotency key for retryable mutations. |
| status action | Calls atomic status RPC; old revision, new status, reason, effective time. |
| task actions | Create/edit/complete/dismiss/snooze with audit. |
| practice actions | Problem/attempt CRUD with validated ownership and analytics refresh. |
| `POST /api/import/preview` | Bounded CSV/TSV input, staging batch; returns counts and paginated preview. |
| `POST /api/import/[id]/commit` | Validated reviewed batch; atomic commit, idempotent response. |
| `GET /api/export?format=csv\|json` | Owner data only; download headers, escaped CSV and safe filename. |
| resume actions/routes | Reserve upload metadata, validate/upload, finalize ready state; authorized signed download and deletion. |
| `POST /api/discovery/refresh` | Verified administrator, global cooldown/rate limit; dispatches the fixed workflow, returns 202 and correlation ID. No arbitrary repo/workflow/URL inputs. |
| `GET /api/discovery/runs/[id]` | Administrator-only safe diagnostics without secrets/private rows. |
| `GET /api/discovery/health` | Sanitized source last-success/stale summary for active verified users. |
| onboarding/profile actions | Save only session user's facts/preferences, increment their profile revision and invalidate their rankings. |
| `POST /api/account/delete` | Reauthenticated self-service idempotent deletion request; accepts no alternate user ID. |
| `GET /api/account/deletion` | Requesting user's safe cleanup progress while Auth account exists. |

Return validation errors with field details, unauthorized 401, forbidden 403, missing 404 without leaking another owner's record, revision/duplicate conflict 409, size limit 413 and rate limit 429. Retry only safe reads/idempotent mutations. Avoid exposing raw SQL errors. Route requests validate content types and reject oversized payloads before processing where possible.

### 15.1 GitHub Actions discovery

Schedule daily at 10:17 UTC (06:17 Puerto Rico) plus `workflow_dispatch`. Run schedules from the default branch. Scheduler delivery is best effort and may be delayed; the UI shows actual successful refresh time. Private repo is preferred for development/operations. Check Actions restrictions, quotas, inactive-workflow behavior and current plans at deployment; do not assume unlimited free automation. See [GitHub workflow events documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Workflow pipeline:

1. Acquire workflow concurrency group and database run lease; stale leases expire after a documented maximum (e.g. 30 minutes). Manual refresh does not start a second overlapping runner.
2. Resolve allowlisted repository paths, fetch with ETag/commit tracking, bounded response size (10 MB/source), 20-second request timeout and up to three retries with jitter. Honor Retry-After and API rate limits. Read-only GitHub token permissions for fetching.
3. Parse each source into typed rows, normalize identity and quarantine malformed data. Persist safe counts and adapter version.
4. Commit accepted snapshot through restricted ingestion RPC; reconcile missing rows only for complete valid snapshots. A 304 reuses the last accepted snapshot and updates health without inventing new listings.
5. Mark per-source and overall run results (`success`, `partial`, `failed`, `held_for_review`) with counts. Last successful source timestamps update only when its snapshot is valid. Preserve last good data on any failure.

Manual web refresh is administrator-only and requires a fine-grained token or GitHub App limited to workflow dispatch on this repository. Keep it server-only, cooldown 15 minutes; map dispatch requests to runs through a correlation UUID workflow input. If this credential is unconfigured, show a clear setup state and link to operator workflow dispatch instead of pretending a refresh started. Do not add Vercel cron in parallel. Reminders are computed from database dates at page load; they need no scheduled background process in MVP.

## 16. Deployment and environment variables

Create separate local/test and production Supabase environments; use a separate preview project or disable production mutations in untrusted previews. Apply version-controlled migrations before promoting the web deployment. Vercel hosts the single Next.js app. Configure HTTPS URL, Supabase auth Site URL/redirect allowlist, production mail delivery, private bucket, initial administrator role and scheduled Actions. Preview callback URLs must be explicit; do not broadly allow arbitrary origins.

| Variable/secret | Location | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local + Vercel | Supabase project endpoint. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local + Vercel | Public browser key, secured by RLS; use documented compatible anon-key fallback only if needed. |
| `APP_URL` | Local + Vercel server | Canonical origin/callback validation. |
| `REGISTRATION_MODE` | Vercel server + matching Supabase settings | `closed_pilot` or `public`; app/provider settings must agree. |
| `SUPABASE_SECRET_KEY` | Trusted lifecycle worker only | Auth deletion/session revocation and owned-object cleanup; compatible service-role fallback only if required. Never ordinary web CRUD. |
| `GITHUB_WORKFLOW_DISPATCH_TOKEN` | Vercel server only, optional until manual web refresh enabled | Restricted workflow dispatch. |
| `GITHUB_WORKFLOW_REPO` | Vercel server | Fixed owner/repo of the app runner, validated configuration. |
| `DISCOVERY_DATABASE_URL` | GitHub Actions secret only | TLS connection with restricted ingestion role. |
| `GITHUB_TOKEN` | Actions-provided | Minimum read permissions for public source reads; dispatch permissions are separate. |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | Trusted migration CI/operator only, when CLI workflow needs them | Deployment/migration administration; never browser/runtime defaults. |
| `TEST_DATABASE_URL`, test auth configuration | Local/test CI only | Isolated test environment and synthetic users. |

Email-provider settings belong in Supabase Auth configuration; do not add unused app SMTP secrets. No LeetCode, OpenAI or FastAPI variables. Provide `.env.example` without real values and validate required variables at startup with actionable errors. Keep `.env.local` ignored. Document key rotation and trusted administrator grant/revocation procedures. Store no secrets in workflow YAML. Pin Actions to reviewed versions/commit SHAs and limit permissions. Never expose production secrets to untrusted pull-request code.

Deployment checklist: provision DB/auth/storage → apply migrations/grants → create pilot accounts and grant initial administrator through trusted setup → configure redirects/mail → deploy in closed-pilot mode → test signup/recovery/onboarding/isolation/deletion → run and review shared discovery → perform per-user reviewed imports → verify quota/cost/abuse controls → meet §22 public-release gates → enable public registration and schedule. Export before destructive migrations; document recovery and review paid backup/PITR needs rather than claiming free tiers guarantee backups.

## 17. Nonfunctional requirements and constraints

- Target first-use authenticated page render under 3 seconds and ordinary reads/mutations under 2 seconds on a warm connection, assessed with 500 applications, 2,000 jobs and 2,000 practice attempts. These are targets; cold starts/provider conditions may exceed them.
- Import preview at the maximum input size must remain bounded and paginated; source ingestion runs outside web request time limits. Set explicit query limits and avoid N+1 queries.
- No paid service is required by design, but pricing, free quotas, email delivery, storage, project pausing, hosting usage and Actions limits change. Verify current plans before deployment; do not guarantee zero operating costs or continuous availability.
- Repository formats can change or feeds can disappear. The app remains useful for manual tracking/import when discovery fails.
- No arbitrary scraping, guaranteed employer availability, comprehensive eligibility verification or automatic LeetCode API access. Manual verification and entry are first-class workflows.
- Persist partial historical data accurately. Unknown is preferable to an invented deadline, citizenship fact, requisition ID, application season or resume claim.
- Operational logs retain safe diagnostics for 30 days by default. Temporary import file objects, if used, are removed after commit/cancel or seven days; retained row provenance remains private until its batch is explicitly purged. Document cleanup execution.

## 18. Tests and release acceptance criteria

Use Vitest for pure rules/adapters; database integration tests against isolated Supabase/Postgres for transactions/RLS; Playwright for essential user flows. Test behavior and failure cases rather than duplicating implementation. CI must run formatting/lint, TypeScript check, unit/database tests, production build and core E2E tests with synthetic data.

| ID | Required acceptance evidence |
| --- | --- |
| AC-01 | Signup, verification, login/logout and password recovery work. Anonymous/unverified clients cannot access workspace data/files. Expired/reused links are recoverable; auth responses avoid account enumeration. |
| AC-02 | Two verified users independently use the app but cannot access each other's rows/storage or attach foreign IDs. Anonymous, unverified, suspended and administrator clients cannot bypass private ownership. Direct API/DB/storage tests verify this. |
| AC-03 | Create/edit application, change status twice, reopen with a reason: current status and immutable timeline agree. Failed transactions leave neither half updated; stale revisions conflict. |
| AC-04 | Prepared Pinterest/PDT-shaped fixtures have no submission date and contribute zero submitted applications. Opening an apply link makes no status change. |
| AC-05 | Tasks due today/overdue/future display correctly in Puerto Rico; timed deadlines across midnight and date-only deadlines do not shift incorrectly. Complete/snooze is audited and retry-safe. |
| AC-06 | Seven-column import fixtures cover Pending, Ghosted, Not Proceeding, SCREENING PROCESS, offer dates, repeated companies/portal links, named/partial dates, BOM, quoting, blanks and malformed rows. Original facts remain retrievable. |
| AC-07 | Preview requires explicit resolution/skip of invalid rows; commit totals reconcile; retry/reimport creates no repeat-batch duplicates. Identical source rows are reviewed, not silently collapsed. Undo preserves records edited since import. |
| AC-08 | Both source adapters pass captured, licensed fixture tests; continuation rows, categories, closed markers, multiple locations and unknown constraints normalize correctly. No live network required for unit tests. |
| AC-09 | Same exact job from two feeds has one catalog record/two observations; different requisitions, tenants or seasons remain separate. Shared candidate portals are never unique keys. |
| AC-10 | Timeout, 429, malformed source, suspicious row collapse and partial snapshot retain good data. Missing-state reconciliation occurs only after qualifying complete snapshots; jobs/applications are never deleted on disappearance. |
| AC-11 | Known incompatible graduation range is filtered; May 2029-compatible constraints pass; unknown citizenship/clearance/remote Puerto Rico restrictions produce needs_review. Authorization does not imply citizenship. |
| AC-12 | Source-only jobs show unverified availability, source links, real refresh timestamps and estimated score breakdown. First-seen date is never mislabeled employer posting date. Confirmed applied roles hide by exact identity; uncertain matches remain reviewable. |
| AC-13 | Manual practice entry/repeat attempts produce correct distinct counts, difficulty/topic analytics and local-day streaks. Hints/reviewed solutions do not count as independent solves. Small samples show limited data. |
| AC-14 | Resume uploads reject unsupported/oversized/disguised files; valid PDF/DOCX are private. New versions preserve earlier bytes and associations; cross-user signed-download requests fail. Interrupted upload/deletion can be retried/cleaned up. |
| AC-15 | Dashboard values equal filtered database/CSV results on known fixtures. Partial/unknown submission dates do not fabricate weekly bars; historic offers survive later status changes. |
| AC-16 | Mobile at 375px supports all core tasks, keyboard navigation works, inputs are labeled, and charts have accessible alternatives. Empty/loading/error/offline failure states are usable. |
| AC-17 | Actions manual and scheduled discovery operate without a local computer; overlap is prevented, run states correlate, restricted runner cannot read private data, and stale health is visible. |
| AC-18 | Import/notes/source malicious HTML, unsafe URLs, spreadsheet formulas, oversized payloads and forged ownership are safely rejected/escaped. Exports contain only the requesting user's records and secret scan finds no credential leaks. |
| AC-19 | A clean clone follows README to start locally, apply migrations, seed synthetic data, run checks and deploy. Missing cloud credentials produce honest setup states, not fake successful integrations. |
| AC-20 | New users start with empty workspaces and unknown personal facts. Two different graduation/sponsorship/location profiles produce independently correct eligibility, scores and dashboards; changing one profile invalidates only that user's cached results. |
| AC-21 | Ordinary users cannot dispatch discovery, change shared sources, approve global merges, edit roles or read detailed run diagnostics. Administrator grants/revocations take effect without trusting client metadata; administrators still cannot read private workspaces. |
| AC-22 | The same resume bytes or import file in two accounts create separate private records without revealing the other upload/import. Concurrent quota reservations cannot exceed limits; rejected uploads leave no untracked objects. |
| AC-23 | Account deletion immediately blocks access and eventually removes Auth identity, private rows and storage objects. Injected cleanup failures retry safely. Shared jobs and other users' records remain intact; deletion cannot target another account. |
| AC-24 | Signup/resend/upload/import abuse produces bounded generic errors and 429 responses. Suspension blocks existing sessions at database and storage layers, not just UI. No client can promote its role or reset usage counters. |
| AC-25 | One shared refresh supplies two users without duplicate source fetches. Each user's applied/hide/verification state stays separate, and personalized responses cannot leak through server caches or CSV exports. |
| AC-26 | Landing, privacy and terms pages contain no pilot-user data or unsupported coverage claims. Production verification/recovery emails, quota usage views, operator cost alerts and public-registration pause control are verified before opening signup. |

Before release, run one controlled live refresh and a small owner-reviewed import, confirm manual employer/source labels, test production verification/recovery redirects and protected resume download, and check a recoverable export. Live integration checks complement fixture tests; they cannot guarantee future source stability.

## 19. Phases and effort estimates

Estimates assume one developer working part-time with Claude Code, existing account access and ordinary troubleshooting. They are planning estimates, not deadlines. Budget approximately 78–136 focused hours across 6–9 weeks for the public-ready MVP; protect internship application and interview-preparation time rather than allowing this project to replace them.

| Phase | Estimated effort | Deliverable/gate |
| --- | ---: | --- |
| 0 — Foundation | 10–16 hours | Scaffold, migrations, signup/verification/recovery, per-user RLS/storage, protected admin roles, synthetic seed and CI. Gate: direct isolation tests. |
| 1 — Useful tracker | 12–20 hours | Application CRUD/history/notes/tasks/interviews and reviewed log import/export. Gate: AC-03 through AC-07; owner can use it before discovery. |
| 2 — Discovery | 12–22 hours | Both adapters, identity/provenance, eligibility/ranking, scheduled/manual runner and source health. Gate: AC-08 through AC-12 and AC-17. |
| 3 — Preparation and resumes | 10–18 hours | Manual DSA tracking, resume versions, dashboard definitions/charts. Gate: AC-13 through AC-15. |
| 4 — Multi-user pilot and hardening | 18–30 hours | Onboarding, quotas, deletion worker, admin controls, privacy pages, accessibility, security/E2E tests and bounded load checks. Gate: all acceptance criteria and pilot smoke checks. |
| 5 — Public release | 16–30 hours | Classmate pilot feedback fixes, production email/abuse/cost verification and public registration rollout. Gate: §22 launch gates. |

After MVP: consider documented integrations, optional reminders, then human-reviewed resume tailoring. Add these only when actual daily use demonstrates value. No roadmap item should block the core tracker release.

## 20. Claude Code build instructions

Use this file as the implementation contract. Start building the foundation and tracker; do not spend the first milestone generating every UI page without persisted working behavior.

1. Inspect repository instructions and existing code first. Treat synced `sources/` and project references as read-only. Build in a dedicated application directory/repository; never overwrite source materials or copy private resume/log contents into Git history.
2. Verify the current stable stack compatibility using official documentation, scaffold Next.js App Router/TypeScript/Tailwind/shadcn, and pin versions. Do not introduce Streamlit, FastAPI or another backend service.
3. Create a short implementation checklist keyed to requirement/acceptance IDs. Document routine assumptions and continue; ask only for necessary credentials or unresolved factual decisions. Unknown facts should remain unknown without blocking manual tracking.
4. Implement SQL migrations, constraints, ownership policies and critical atomic operations before UI mutations. Generate Supabase TypeScript types. Verify isolation using two synthetic users and anonymous requests.
5. Deliver one working vertical flow: user signup/verification → personalized onboarding → create prepared application → attest submission → append status event → add follow-up → export. Then implement staged seven-column import with preview and repeat protection.
6. Add source adapters after inspecting actual source data/license/default branches. Capture small safe fixtures, version adapters and test normalization/dedupe/failure handling before enabling the schedule. Use TypeScript runner in Actions and restricted ingestion identity.
7. Implement manual DSA tracking and private resume version storage, then derive dashboard charts from defined metrics. Do not fake records, completed integrations, API availability or successful deployments.
8. Match UX requirements and review mobile/accessibility behavior. Keep the product free of internal build details; explain uncertainties through useful labels such as "Needs eligibility review" and "Last refreshed."
9. Run the required checks and fix failures. Maintain README, `.env.example`, schema/migrations, synthetic fixtures, operational instructions and traceability checklist. Report checks not run and why; do not claim they passed.
10. Prepare cloud deployment configuration and document the exact remaining account/credential steps. The owner must provide authorized account access/secrets outside source code. Do not purchase services, submit internship applications, send follow-up messages, or publish private source data as a side effect of building.

**Definition of done:** public signup/onboarding and multi-user isolation work; administrator controls, quotas, self-service deletion and public-release gates pass; all MVP capabilities work against persisted data; all acceptance gates pass; production login and privacy smoke checks succeed; discovery health and failure recovery are visible; reviewed import reconciles its rows; setup/deployment/export instructions are reproducible; and no core path depends on mock data or unavailable third-party APIs.

## 21. Implementation references

These references identify current source/configuration guidance, not fixed guarantees. Recheck them when implementing:

- [Next.js App Router documentation](https://nextjs.org/docs/app).
- [Supabase Next.js Auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/nextjs) and [server-side auth guidance](https://supabase.com/docs/guides/auth/server-side).
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [GitHub Actions scheduled workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- [Simplify Summer 2027 list](https://github.com/SimplifyJobs/Summer2027-Internships) and [vanshb03 Summer 2027 list](https://github.com/vanshb03/Summer2027-Internships).

Private resume/log links in §2 are evidence references; accessing them requires the owner's account or supplied exports. This PRD intentionally specifies migration behavior without embedding the full private log or contact information.

## 22. Public multi-user product requirements

This section extends the MVP to a public service. Apply it together with the updated auth, UX, data model, deployment and acceptance sections. No single-owner access restriction may remain in production paths. Anthony's existing requirements remain a private pilot use case, not defaults for other accounts.

### 22.1 Registration and personalized onboarding

1. Public landing page explains application tracking, manual DSA tracking, private resume storage and actual discovery coverage. Offer signup/login, privacy and terms links; use synthetic examples only.
2. Signup accepts email/password with provider-supported password rules and shows a generic confirmation response. Users verify email before workspace access. Provide bounded resend, recovery and expired-link workflows. Verification and recovery messages are the only mandatory outgoing email in MVP.
3. Bootstrap an empty profile and active account state once, using an idempotent trusted operation. Do not copy another user's data, resume links or applications. A failure must be retryable without duplicate profiles.
4. Onboarding collects university/degree, graduation month/year, target season, preferred technical categories, locations/countries, remote/relocation preferences, work authorization and sponsorship needs, confirmed skills, practice language, weekly goal and IANA timezone. Authorization records identify their relevant country; US authorization is not transferable to another jurisdiction.
5. Sensitive/uncertain facts may remain unknown. Citizenship/export-control/clearance questions are optional and explain why they affect eligibility. Do not infer facts from email, institution, name, IP or residence. Do not collect identity documents, government IDs or legal-status evidence.
6. Allow skip/resume and later edits. Show a profile-completeness prompt when missing facts constrain ranking; do not block manual application or practice tracking on graduation/eligibility unknowns.
7. Suggest Summer 2027 because it is the initial catalog coverage. Users may track applications for other seasons and countries; if no configured source covers their selection, show an honest coverage gap and manual entry option. Never promise global discovery merely because global signup is available.

All per-user insights use that user's confirmed profile. There is no global May 2029 filter, US-authorization assumption or Puerto Rico timezone. Test DST boundaries in another timezone in addition to the Puerto Rico pilot fixtures.

### 22.2 Private workspace and shared catalog boundary

- One personal workspace per account in MVP. Applications, notes, tasks, interview/offer events, resumes, imports, practice, manual employer verification and preferences are private by default. No sharing links or public profile endpoints.
- Shared tables contain public jobs, source provenance, taxonomy and safe catalog evidence. Do not attach user application counts, resume contents, contacts or eligibility facts to shared catalog rows.
- Users can save/apply to the same shared job independently. One user applying or hiding a role never removes it from another user's feed. User assertions about employer availability remain private; global verification requires a separate administrator-reviewed public evidence record.
- Shared ingestion is scheduled once per catalog source, not once per user. Use database queries to filter/rank against individual profiles; profile changes never dispatch a new ingestion run.
- All exports, aggregate queries and RPCs enforce session ownership; ordinary UI filters are not a security boundary. Cross-user dedupe of private records is prohibited.
- For global job merges, remap per-user references atomically. If a user saved one duplicate and hid another, preserve both flags and use hidden precedence in the default feed; retain a reviewable merge event. Different users' preferences never resolve against one another. Application snapshots and submission history remain independent.

### 22.3 Administrator permissions and operations

| Actor | Allowed access |
| --- | --- |
| Anonymous/unverified account | Public informational/auth pages; no workspace or protected catalog APIs. |
| Active verified user | Own private records/files, sanitized shared catalog and feed health. |
| Administrator | Same personal workspace privileges plus shared-source configuration, run diagnostics, public catalog review, safe capacity metrics and account suspension. No cross-user private-content access. |
| Discovery runner | Allowlisted fetches and restricted catalog ingestion; no private user data. |
| Lifecycle worker | Only trusted account cleanup/reservation cleanup procedures; no arbitrary browsing/export API. |

Administrators are granted through a trusted operator procedure; signup never grants admin status, including to the first registrant. Use protected role lookup with narrow database grants and audited grant/revoke procedures. A profile update cannot edit roles, account state or quotas.

Administrator actions are audited with actor, action, target and timestamp. Source enable/disable, held snapshot approval, global merge and suspension require verified administrator authorization at both transport and database operation. Allow suspension for abuse with an internal reason code and user-visible support path; suspended users cannot use existing tokens to access data/storage. Keep support access limited to necessary identity/account state, not resume or application content.

### 22.4 Quotas, abuse protection and cost controls

These are initial configurable operating limits, not claims about provider capacity:

| Limit | Initial value and behavior |
| --- | --- |
| Resume upload | 10 MB/file, 20 ready versions and 100 MB total/account, including outstanding reservations. |
| Applications | 2,000 active/nonpermanently-deleted records/account; trash counts until purged. |
| Practice attempts | 10,000/account; show usage and export option at the limit. |
| Import | Existing 5 MB/5,000 input rows; accepted new rows must also fit application quota; at most 5 previews/hour/account. |
| Authentication email | Provider-supported protection plus an initial 3 resend/recovery attempts per 15 minutes/account or normalized-email bucket, with additional IP abuse controls. |
| Uploads | 20 upload reservations/hour/account, bounded storage usage and orphan cleanup. |
| Manual catalog refresh | Administrators only, one global dispatch per 15 minutes with existing concurrency lease. |

Use durable shared rate-limit storage rather than process memory in serverless instances. Implement atomic quota reservations before accepting bytes or committing rows; release reservations on failure/cancel, expire abandoned reservations and reconcile against persisted usage. Users cannot write their own counters. Do not silently drop import rows that exceed quota: preview explains the limit and requires explicit reduction/cancellation. Show usage, remaining capacity and export/delete actions; paid upgrades are outside MVP.

Enable Supabase-supported signup abuse protection; introduce a challenge when traffic warrants it or provider setup requires it. Enforce provider and app limits together, use generic auth responses to avoid enumeration, and keep short-lived abuse signals free of unnecessary personal data. Configure a public-registration pause switch that blocks new registrations while allowing existing legitimate users to keep working. Pausing app signup must also align with provider signup controls; hiding a form alone is insufficient.

Operators monitor total active accounts, database/storage usage, mail volume, Actions runs/minutes and deployment bandwidth/error rates through provider dashboards and safe aggregated app metrics. Configure alerts at 70%, 90% and 100% of operator-defined monthly budgets/capacity, document the response, and verify alert delivery. Budget values are supplied during deployment; do not invent a free-tier guarantee. Start with a bounded pilot and scale only after measuring real use.

### 22.5 Privacy, export and account deletion

Provide public privacy and terms pages describing actual collected data, purposes, service providers, visibility, retention/deletion, support contact, acceptable use and coverage limitations. Use an operator-supplied contact address; do not publish Anthony's personal address from a resume. Record accepted terms version/time on signup; keep a versioned policy change process. Any jurisdiction-specific legal obligations require separate review before public launch; this PRD is a product specification, not a legal determination.

No public leaderboard, advertising/tracking SDK, selling private data or third-party model processing of resumes is part of MVP. Operational analytics use bounded aggregate counts and error codes without notes, resumes, email addresses or application content. Private pilot reference files are never shipped with the site or committed to a public repository.

Deletion flow:

1. Require recent reauthentication, clearly explain scope and offer an export before confirmation. Create an idempotent request tied only to the session user.
2. Set deletion-requested account state atomically and block all normal workspace/storage access immediately. Revoke active sessions. Do not let old issued tokens bypass account-state checks. Progress endpoint returns only safe own-request state while the identity still exists.
3. A trusted lifecycle worker removes that user's owned storage objects, private database rows and import artifacts, then deletes the Auth identity. Persist checkpoints so partial failures can retry. Never delete shared public jobs, other accounts or administrator audit facts about catalog actions.
4. Target completion within seven days; alert operators on requests older than 24 hours or repeated failures. Publish the actual retention policy and explain backup expiry rather than claiming immediate erasure from backups. Operational user identifiers are purged/anonymized according to the documented policy; retain only minimal noncontent audit facts needed for integrity.

Run deletion/expired-reservation cleanup at least daily through a separate protected scheduled workflow. Give its secret only to the lifecycle job, not the discovery job or normal web runtime. The web request queues deletion through the session-authorized database operation. The lifecycle worker may require an elevated Supabase key for Auth/session deletion; wrap it in narrow reviewed procedures, validate stored request ownership, never log content and test that malicious request data cannot target another account. Old signed downloads cannot be individually revoked by database RLS alone: keep URLs short-lived (maximum five minutes) and remove objects during cleanup; document this temporary access window.

### 22.6 Public release gates and build sequence

Build multi-user ownership/auth from Phase 0. Anthony uses the first private workspace; invite a few classmates into separate accounts for a closed pilot. The pilot should exercise varied graduation dates, sponsorship needs, timezones, identical imports and resumes, concurrent quota attempts, and shared-job actions.

Before public registration, require AC-01 through AC-26 plus:

- Two normal users and one administrator pass direct privacy/role tests; suspended/deleting accounts cannot bypass them.
- Verification/recovery delivery works in production, including expired links and callback-origin restrictions.
- Account export/deletion and interrupted cleanup are demonstrated end to end.
- A bounded load check with 100 synthetic accounts, 10 concurrent active users, representative per-user data and the shared catalog meets documented targets or records an actionable capacity limit. Never run a destructive load test against real user data.
- Quotas, registration pause, monitoring, budget alerts, recovery instructions and support/contact details are configured.
- Public documentation/examples are sanitized, published policies describe actual behavior, and catalog coverage is honest.

Claude Code must include these requirements in its implementation checklist and tests, remove `OWNER_USER_ID`/single-owner authorization paths, keep administrator privileges separate from private-data ownership, and report remaining launch gates accurately. Public registration is the final rollout step after the pilot gates, not a reason to build a second backend or change the required technology stack.
