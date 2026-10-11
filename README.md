# Hephaestus

A multi-user website for students to track internship applications, follow-ups, resume versions and LeetCode practice, with a shared, honestly-labeled catalog of Summer 2027 internship listings. Implements [PRD.md](PRD.md).

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (Postgres, Auth, Storage) · Vercel · GitHub Actions. No separate backend service.

> This repository contains no private resume, application-log or profile data. All fixtures and seeds are synthetic.

## Quick start (local)

Requires Node 24 (`.nvmrc`) and npm. Docker and the Supabase CLI are only needed to run the full stack locally.

```bash
npm ci
cp .env.example .env.local        # then fill it in
npm test                          # unit + database tests (embedded Postgres, no services needed)
npm run dev                       # http://localhost:3000
```

Without Supabase credentials the app shows a **Setup required** page (`/setup`).

### Run the whole stack locally

```bash
supabase start                    # needs Docker; prints the API URL and publishable key
supabase db reset                 # applies migrations, then the synthetic seed
```

Put the printed URL and key in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and set `APP_URL=http://localhost:3000`. Verification emails land in the local Mailpit inbox that `supabase start` prints.

### Scripts

| Script                                    | What it does                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                           | format check, lint, typecheck, all tests, production build                                                                 |
| `npm test` / `test:unit` / `test:db`      | Vitest (domain, import/export, discovery, web helpers / migrations, RLS, RPCs)                                             |
| `npm run e2e`                             | Playwright at 375 / 768 / 1440 px; signed-in specs need `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and a real Supabase project |
| `npm run discovery` / `npm run lifecycle` | Run the discovery runner / lifecycle worker locally (needs their secrets)                                                  |
| `node scripts/secret-scan.mjs`            | Credential scan of tracked files and the client bundle                                                                     |

## Keeping listings fresh

- **Local or single-user:** set `DISCOVERY_DATABASE_URL` (the restricted `discovery_ingest` role) and, if needed, `DISCOVERY_DATABASE_CA_FILE` in `.env.local`. The app refreshes the shared catalog whenever it is over 6 hours old, shows a toast, and the Jobs page has a **Refresh** button (15-minute cooldown). New listings get a **New** badge for 48 hours.
- **Deployed:** use the daily GitHub Actions workflow (`.github/workflows/discovery.yml`) and keep ingestion credentials out of the web environment.
- **New sources:** add them to `src/lib/discovery/sources.ts`; each run registers missing sources automatically (insert-only; admin-disabled sources stay disabled).

## Project layout

```text
src/app/                 routes: (app) signed-in pages, (auth), (public), api/
src/components/          layout/ charts/ forms/ feedback/ shared/ ui/ (shadcn)
src/lib/
  auth/ supabase/        sessions, display name, clients
  data/                  query helpers and row types
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

- **Ownership is enforced in the database.** Every private table carries `user_id`; RLS requires `auth.uid() = user_id` _and_ an active, email-verified account. Child tables use composite `(parent_id, user_id)` foreign keys, and admins have no policy that reads private rows.
- **Atomic writes go through RPCs** (`create_application`, `change_application_status`, `commit_import_batch`, resume reserve/finalize/delete, `request_account_deletion`, etc.). Clients cannot write `status`, `revision`, history, quotas, roles or account state directly.
- **Discovery is shared and runs off-device.** One scheduled run serves everyone; eligibility, scoring and saved/hidden state are computed per request from the user's own profile, and nothing personalized is cached across users.
- **Honest freshness.** First-seen is not the employer posting date. A job is marked missing only after two complete snapshots at least 24 h apart; failed, partial or suspiciously small (< 50 %) snapshots never change availability.

Migrations live in `supabase/migrations/` (`…01` foundation through `…10` automatic source sync).

## Deployment checklist

Nothing has been deployed from this repository yet. Secrets never go in code.

1. **Supabase:** create a production project and a separate test/preview one. Apply migrations (`supabase link` then `supabase db push`).
2. **Auth settings:** enable email confirmations; set Site URL and explicit redirect URLs (`https://YOUR-DOMAIN/auth/callback`); configure production SMTP and test verification and recovery emails; minimum password length ≥ 10; enable "Allow new users to sign up" and signup abuse protection (CAPTCHA when traffic warrants).
3. **Storage:** migration `…05` creates the private `resumes` bucket; confirm it is _not_ public.
4. **Vercel:** import the repo and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `REGISTRATION_MODE` (`public` by default), `SUPPORT_EMAIL`, `RATE_LIMIT_SALT`, `TERMS_VERSION`. Do **not** add `SUPABASE_SECRET_KEY` or `DISCOVERY_DATABASE_URL`.
5. **GitHub Actions secrets:** `DISCOVERY_DATABASE_URL` (discovery) and `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (lifecycle). Create the ingestion login first, as the postgres role:
   ```sql
   alter role discovery_ingest login password '<long random password>';
   ```
   Use the pooled connection string with that role. If Node cannot verify the TLS chain, set the optional `DISCOVERY_DATABASE_CA` secret.
6. **First administrator** (signup never grants admin):
   ```sql
   insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
   -- revoke:
   delete from public.user_roles where user_id = (select id from auth.users where email = 'you@example.com') and role = 'admin';
   ```
7. **Manual refresh button (optional):** create a fine-grained token with only _Actions: write_ on this repo and set `GITHUB_WORKFLOW_DISPATCH_TOKEN` and `GITHUB_WORKFLOW_REPO` in Vercel.
8. **Before launch:** test signup, recovery, onboarding, isolation, export and deletion; run discovery and review the first snapshot; verify quotas and alerts.

**Operations notes**

- _Registration pause:_ set `REGISTRATION_MODE=closed_pilot` **and** disable signups in Supabase Auth. Both must agree; hiding the form alone is not a pause.
- _Alerts:_ set budget/capacity alerts at 70 / 90 / 100 % in Vercel, Supabase and GitHub. The admin **Runs** tab shows capacity numbers and deletion requests older than 24 h.
- _Backups:_ export before destructive migrations; free plans do not guarantee backups.
- _Key rotation:_ update the Supabase secret key, ingestion password or dispatch token secret, then re-run the workflow once.
- _Adapter changes:_ to force a reload after bumping an adapter version, clear `job_sources.etag` and `last_commit_sha` for that source.
- _Scheduling:_ GitHub scheduled runs are best-effort; the UI always shows the actual last successful refresh time.

## Verification status

Passing locally: lint, typecheck, production build, secret scan, 241+ Vitest tests, and 42 Playwright tests (public pages, route protection, headers, 375/768/1440 layouts).

- Database behavior (RLS, grants, RPCs, imports, quotas, ingestion, deletion, storage policies) is tested on embedded Postgres (PGlite) with stubbed Supabase `auth`/`storage` schemas. This is not a substitute for running the suite against a real Supabase project.
- **Not run:** signed-in Playwright flows, real email delivery, multi-connection quota concurrency, live GitHub Actions runs, a real discovery refresh, production deployment, an assistive-technology accessibility audit, and the 100-account load check against real Supabase (a bounded PGlite version is in `tests/db/load.test.ts`).
- `src/lib/db-types.ts` is hand-written; run `supabase gen types` once a project exists if you want generated types.

## Requirement traceability

| PRD ID / AC            | Implementation                                                                                           | Evidence                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| AUTH, AC-01            | `src/app/(auth)/*`, `src/app/auth/callback`, `src/proxy.ts`, `src/lib/auth/*`, `is_active_user()`        | `tests/e2e/public.spec.ts`, `tests/db/security.test.ts`, `web-security.test.ts` |
| ONBOARD, AC-20         | `/onboarding`, `/settings`, `profiles` (all facts nullable), `profile_revision` trigger                  | `domain-eligibility-scoring.test.ts`                                            |
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
| AC-25 (shared refresh) | one ingestion run; per-user `user_jobs`; per-request scoring                                             | `tests/db/discovery.test.ts`                                                    |

## Private data

Original application logs, resume exports and profile facts are **not** in this repository. After signing in, enter your profile in Settings and import your own CSV through `/import`; nothing is pre-populated.
