# Hephaestus

A multi-user website for students to track internship applications, follow-ups, resume versions and manual LeetCode practice, with a shared, honestly-labeled catalog of Summer 2027 internship listings. Implements [PRD.md](PRD.md).

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (Postgres, Auth, Storage) · Vercel · GitHub Actions. No separate backend service.

> This repository is public-safe: it contains no private resume, application-log or profile data. All fixtures and seeds are synthetic.

## Quick start (local)

Requirements: Node 24 (`.nvmrc`), npm. Docker + the Supabase CLI are only needed to run the full app locally.

```bash
npm ci
cp .env.example .env.local        # then fill it in (see below)
npm test                          # unit + database tests (embedded Postgres, no services needed)
npm run dev                       # http://localhost:3000
```

Without Supabase credentials the app shows an honest **Setup required** page (`/setup`) instead of pretending to work.

### Run the whole stack locally

```bash
supabase start                    # needs Docker; prints the API URL and publishable key
supabase db reset                 # applies supabase/migrations/* then supabase/seed.sql (synthetic data)
```

Put the printed URL and publishable key in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and set `APP_URL=http://localhost:3000`. Verification emails are caught by the local Mailpit inbox that `supabase start` prints.

### Scripts

| Script                                    | What it does                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                           | format check, lint, typecheck, all tests, production build                                                                                          |
| `npm test` / `test:unit` / `test:db`      | Vitest (domain, import/export, discovery, web helpers / migrations, RLS, RPCs)                                                                      |
| `npm run e2e`                             | Playwright at 375 / 768 / 1440 px. Public specs always run; signed-in specs need `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and a real Supabase project |
| `npm run discovery` / `npm run lifecycle` | Run the discovery runner / lifecycle worker locally (needs their secrets)                                                                           |
| `node scripts/secret-scan.mjs`            | Credential scan of tracked files and the client bundle                                                                                              |

## Keeping listings fresh automatically

- **Local or single-user:** put `DISCOVERY_DATABASE_URL` (the restricted `discovery_ingest` role) and, if needed, `DISCOVERY_DATABASE_CA_FILE` in `.env.local`. The app then refreshes the shared catalog on its own whenever it is more than 6 hours old: it checks quietly after you open any page, shows a toast ("N new listings loaded"), and the Jobs page also has a **Refresh** button (15-minute cooldown). New listings get a **New** badge for 48 hours.
- **Deployed:** prefer the scheduled GitHub Actions workflow (`.github/workflows/discovery.yml`, daily) and keep the ingestion credentials out of the web environment.
- `npm run discovery` still works for a manual run.
- **New sources:** entries added to `src/lib/discovery/sources.ts` are picked up automatically after the one-time migration `…10` (`sync_job_sources`): each run registers missing sources (insert-only; a source an admin disabled is never re-enabled). No manual SQL needed.

## Project layout

```text
src/app/                 routes: (app) signed-in pages, (auth), (public), api/
src/components/          layout/ charts/ forms/ feedback/ shared/ ui/ (shadcn)
src/lib/
  auth/ supabase/        sessions, display name, clients
  data/                  query helpers and row types (types.ts)
  domain/                pure rules: dates, status, scoring, analytics
  import/ export/        CSV pipeline
  discovery/             source adapters, runner, pg adapter
  jobs/                  feed ranking, prefs, company logos, freshness
  leetcode/              public-profile client, catalog, recommendations
  server/                env, http helpers, rate limiting
  ui/                    formatting and chart colors
  validation/            Zod schemas
scripts/                 discovery and lifecycle entry points
supabase/                migrations, config, synthetic seed
tests/                   unit, db (embedded Postgres), e2e (Playwright)
```

## How it works

```
Browser → Next.js on Vercel → Supabase Auth / Postgres / Storage
GitHub Actions → TypeScript adapters → restricted ingestion RPC → Postgres
```

- **Ownership is enforced in the database.** Every private table carries `user_id`; RLS requires `auth.uid() = user_id` _and_ an active, email-verified account. Child tables use composite `(parent_id, user_id)` foreign keys so a guessed foreign ID cannot attach. Administrators have no policy that reads private rows.
- **Writes that must be atomic go through RPCs** (`create_application`, `change_application_status`, `commit_import_batch`, `undo_import_batch`, resume reserve/finalize/delete, `request_account_deletion`, admin and ingestion functions). Clients cannot write `status`, `revision`, history tables, quotas, roles or account state directly (column grants + no policies).
- **Discovery is shared and runs off-device.** One scheduled GitHub Actions run serves everyone; eligibility, scoring, saved/hidden state and employer verification are personal and computed per request from that user's own profile. Nothing personalized is cached across users.
- **Honest freshness.** First-seen ≠ employer posting date. Source rows only prove "listed on GitHub". A job is marked missing only after two complete snapshots ≥ 24 h apart; failed, partial or suspiciously small (< 50 %) snapshots never change availability.

Repository layout follows PRD §12. Database migrations live in `supabase/migrations/` (`…01` foundation, `…02` schema, `…03` RLS and grants, `…04` RPCs, `…05` storage, `…06` source seed, `…07` search columns, `…08` import summary grant, `…09` more sources, `…10` automatic source sync).

## Deployment checklist (PRD §16)

Nothing here has been deployed from this repository yet. The owner must do these account steps; secrets never go in code:

1. **Supabase project** (production) and a separate one for tests/previews. Apply migrations (`supabase link` then `supabase db push`, or run the SQL files in order in the SQL editor).
2. **Auth settings**: enable email confirmations; set Site URL and add only explicit redirect URLs (`https://YOUR-DOMAIN/auth/callback`); configure production email delivery (custom SMTP recommended) and **test verification and recovery emails**; set minimum password length ≥ 10; enable Supabase's signup abuse protection (CAPTCHA when traffic warrants). In the closed pilot, disable "Allow new users to sign up" and set `REGISTRATION_MODE=closed_pilot`; create pilot accounts from the dashboard (invite).
3. **Storage**: migration `…05` creates the private `resumes` bucket and policies; confirm the bucket is _not_ public.
4. **Vercel**: import the repo; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `REGISTRATION_MODE`, `SUPPORT_EMAIL`, `RATE_LIMIT_SALT`, `TERMS_VERSION`. Do **not** add `SUPABASE_SECRET_KEY` or `DISCOVERY_DATABASE_URL` to Vercel.
5. **GitHub Actions secrets** (repo): `DISCOVERY_DATABASE_URL` (discovery only) and `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (lifecycle only). Create the ingestion login first (SQL editor, as the postgres role):
   ```sql
   alter role discovery_ingest login password '<generate a long random password>';
   ```
   Use the pooled connection string with that role. If Node cannot verify the TLS chain, set the optional `DISCOVERY_DATABASE_CA` secret (see `scripts/lib`).
6. **First administrator** (trusted operator step; signup never grants admin):
   ```sql
   insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
   -- revoke:
   delete from public.user_roles where user_id = (select id from auth.users where email = 'you@example.com') and role = 'admin';
   ```
7. **Manual refresh button (optional)**: create a fine-grained token with only _Actions: write_ on this repo, set `GITHUB_WORKFLOW_DISPATCH_TOKEN` and `GITHUB_WORKFLOW_REPO` in Vercel. Without them the button explains how to run the workflow from the Actions tab.
8. Deploy in closed-pilot mode → test signup, recovery, onboarding, isolation, export and deletion → run discovery and review the first snapshot → do owner-reviewed imports → verify quotas and alerts → work through the launch gates below → set `REGISTRATION_MODE=public` **and** enable provider signups.

**Operations notes**

- _Registration pause_: set `REGISTRATION_MODE=closed_pilot` and disable signups in Supabase Auth. Both must agree; hiding the form alone is not a pause.
- _Alerts_: configure budget/capacity alerts at 70 / 90 / 100 % in Vercel, Supabase and GitHub billing, and verify delivery. The admin **Runs** tab shows safe aggregate capacity numbers and deletion requests older than 24 h. `scripts/lifecycle.ts` exits non-zero when a deletion is stale.
- _Backups_: export before destructive migrations. Review paid backup/PITR needs; free plans do not guarantee backups.
- _Key rotation_: rotate the Supabase secret key, ingestion role password and dispatch token by updating the corresponding secret, then re-running the workflow once.
- _Adapter changes_: bumping an adapter version does not reprocess unchanged content; clear `job_sources.etag` and `last_commit_sha` for that source to force a reload.
- _Scheduling_: GitHub scheduled runs are best-effort and can be delayed; scheduled workflows in inactive repos can be disabled. The UI always shows the actual last successful refresh time.

## Verification status (what has and has not been run)

Run and passing locally: lint, typecheck, production build, secret scan, **241+ Vitest tests**, and **42 Playwright tests** (public pages, route protection, headers, 375/768/1440 layout).

- Database behavior (RLS, grants, RPCs, status timeline, import commit/undo, quotas, ingestion, merge, deletion cascade, storage policies) is tested on **embedded Postgres (PGlite)** with the Supabase `auth`/`storage` schemas stubbed (`tests/db/harness.ts`). This is a strong check of the SQL but **not** a substitute for running the same suite against a real Supabase project (real PostgREST, Auth and Storage API).
- **Not run**: signed-in Playwright flows (need a real Supabase project), real signup/verification/recovery email delivery, true multi-connection concurrency tests for quota reservations, live GitHub Actions runs, a real discovery refresh against the live database, production deployment, accessibility audit with assistive technology, and the 100-account load check against a real Supabase instance (a bounded PGlite version exists in `tests/db/load.test.ts`).
- Supabase TypeScript types are not generated (no CLI available here); `src/lib/db-types.ts` is hand-written. Run `supabase gen types` once a project exists if you want generated types.

### Remaining public-release gates (PRD §22.6)

Before setting `REGISTRATION_MODE=public`: run the DB suite and the signed-in E2E suite against a real Supabase test project; verify production verification/recovery email and callback-origin restrictions; demonstrate export and deletion end to end (including an injected cleanup failure); run the 100-account load check against the real stack; configure quotas monitoring, budget alerts, registration pause and support contact (`SUPPORT_EMAIL`); get privacy/terms reviewed for your jurisdiction (this is a product spec, not legal advice); run a closed pilot with a few classmates.

## Requirement traceability

| PRD ID / AC            | Implementation                                                                                           | Evidence                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| AUTH, AC-01            | `src/app/(auth)/*`, `src/app/auth/callback`, `src/proxy.ts`, `src/lib/auth/*`, `is_active_user()`        | `tests/e2e/public.spec.ts`, `tests/db/security.test.ts`, `web-security.test.ts` |
| ONBOARD, AC-20         | `/onboarding`, `/settings`, `profiles` (all facts nullable), `profile_revision` trigger                  | `domain-eligibility-scoring.test.ts` (two-profile independence)                 |
| ADMIN, AC-21           | `/admin/*`, `admin_*` RPCs, `user_roles`, audit table                                                    | `tests/db/security.test.ts`, `tests/db/discovery.test.ts`                       |
| PUBLIC, AC-23/24/26    | `/privacy`, `/terms`, `/settings/account`, deletion RPC + `scripts/lifecycle.ts`, quotas, `rate_limit_*` | `tests/db/security.test.ts`, `tests/db/tracker.test.ts`, E2E                    |
| APP, AC-03/04/05       | `/applications*`, `create_application`, `change_application_status`, task triggers                       | `tests/db/tracker.test.ts`, `domain-dates-status-tasks.test.ts`                 |
| IMPORT, AC-06/07/18    | `src/lib/import`, `/import*`, `commit_import_batch`, `undo_import_batch`, export routes                  | `tests/unit/import-*`, `export-csv`, `tests/db/tracker.test.ts`                 |
| JOB, AC-08–12, AC-17   | `src/lib/discovery`, `scripts/discovery.ts`, `ingest_source_snapshot`, `/jobs*`, eligibility + scoring   | `tests/unit/discovery-*`, `tests/db/discovery.test.ts`, domain tests            |
| DSA, AC-13             | `/practice`, `practice_*` tables, `practiceSummary`                                                      | `domain-analytics.test.ts`, `tests/db/tracker.test.ts`                          |
| RESUME, AC-14/22       | `/resumes`, `/api/resumes*`, reserve/finalize RPCs, storage policies, `validateResumeFile`               | `web-security.test.ts`, `tests/db/security.test.ts`                             |
| DASH, AC-15            | `/dashboard`, `src/lib/domain/analytics.ts`, `BarSeriesChart` (+ table view)                             | `domain-analytics.test.ts`                                                      |
| OPS, AC-19             | migrations, `.env.example`, CI, `secret-scan`, this README                                               | `.github/workflows/ci.yml`                                                      |
| AC-16 (a11y/mobile)    | skip link, labeled controls, text status badges, table alternatives, sheet nav                           | `tests/e2e/public.spec.ts` (partial; no screen-reader audit)                    |
| AC-25 (shared refresh) | one ingestion run; per-user `user_jobs`; per-request scoring (no shared personalized cache)              | `tests/db/discovery.test.ts` (merge/independence)                               |

## Pilot note

The private pilot material (original application log, resume exports, profile facts) is **not** in this repository. The owner enters their own profile in Settings and imports their own CSV export through `/import` after signing in; nothing is pre-populated.
