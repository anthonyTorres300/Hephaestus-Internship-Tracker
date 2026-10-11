# Hephaestus

Hephaestus is a free, private workspace for students hunting for internships. Track every application, find new listings, keep your resume versions straight, and practice for interviews, all in one place.

Your applications, notes, resumes and practice history are visible only to you.

## What you can do

- **Track applications.** Log each application with its company, role, status, priority, links and notes. Statuses run from Saved and Prepared through Applied, Screening, Assessment, Interview, Offer, Accepted, Rejected, Withdrawn and Ghosted, and every change is kept in a timeline.
- **See your pipeline.** View applications as a sortable list or as a drag-and-drop board. Click a column header (Company, Status, Submitted, Priority) to sort, and choose to show 25, 50, 100 or 200 at a time.
- **Organize by season.** Your target season (for example Summer 2027) is a tab on the Applications page. Click **+ New season** to create your own, such as "Summer 2026" or "Co-op 2027". Each season gets its own tab, and the Dashboard can filter by it too.
- **Update many at once.** Tick the boxes next to applications, then change their status, priority or season, or archive or trash them, in one step.
- **Import your existing log.** Upload a CSV or TSV (or paste rows) and review every row before anything is saved. Your original values are always kept, and an import can be undone.
- **Browse internship listings.** The Jobs page shows a shared catalog of Summer 2027 internships, ranked for you by the role types, location and eligibility details you enter in Settings. Save, hide or apply to a listing in one click.
- **Stay on top of follow-ups.** Add tasks, interviews and notes to any application, and the Dashboard shows what is due.
- **Keep resume versions.** Upload PDF or Word resumes (up to 10 MB each) and attach the right version to each application.
- **Practice.** Log LeetCode attempts, track a weekly goal and review your history, and get recommended problems.
- **Own your data.** Export everything to CSV any time, and delete your account and data from Settings.

## Getting started

1. **Sign up** with your email and a password of at least 10 characters, then confirm the email we send you.
2. **Fill in Settings** (optional but useful): graduation date, target season, time zone, work authorization, and the roles you want. These only personalize your job rankings, and you can leave anything blank.
3. **Add your first application** with **New application**, or bring your history in with **Import from CSV** (use the template on the import page).
4. **Check the Jobs page** for fresh listings, and the Dashboard for your pipeline and what is due.

### Tips

- Press `/` to jump to the search box and `n` to start a new application.
- Use the **Filters** button next to a search to narrow by priority, location or date.
- Moving an application to Applied or later asks you to confirm you submitted it and when. Dates are never guessed; if you do not know, mark the date as unknown.
- A season you create can be removed once it has no applications. Applications are never deleted by removing a season.

## Good to know

- **Listings are labeled honestly.** "New" means we first saw a listing recently, not that the employer just posted it. A listing is marked missing only after it has been gone across two complete checks at least a day apart. Always confirm details on the employer's own site before applying.
- **Limits.** Up to 2,000 applications per account, 5 import previews per hour, imports up to 5 MB or 5,000 rows, and up to 40 custom seasons.
- **Privacy.** Your data is protected in the database so other users cannot read it, and administrators cannot read your private records. See the in-app Privacy and Terms pages for details.
- **Something not working?** Contact the support address shown on the site, and include what you clicked and what you expected.

---

## For developers and site owners

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (Postgres, Auth, Storage) · Vercel · GitHub Actions. The product spec is in [PRD.md](PRD.md).

> The repository contains no private resume, application-log or profile data. All fixtures and seeds are synthetic.

### Run it locally

Requires Node 24 (`.nvmrc`) and npm. Docker and the Supabase CLI are only needed to run the full stack locally.

```bash
npm ci
cp .env.example .env.local        # then fill it in
npm test                          # unit + database tests (embedded Postgres, no services needed)
npm run dev                       # http://localhost:3000
```

Without Supabase credentials the app shows a **Setup required** page (`/setup`). To run everything locally, `supabase start` (needs Docker) then `supabase db reset`, and put the printed URL and publishable key in `.env.local` along with `APP_URL=http://localhost:3000`. Verification emails land in the local Mailpit inbox.

| Script                                    | What it does                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run check`                           | format check, lint, typecheck, all tests, production build                                          |
| `npm test` / `test:unit` / `test:db`      | Vitest (domain, import/export, discovery, web helpers / migrations, RLS, RPCs)                      |
| `npm run e2e`                             | Playwright; signed-in specs need `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and a real Supabase project |
| `npm run discovery` / `npm run lifecycle` | Run the listing-discovery runner / account-lifecycle worker locally (needs their secrets)           |
| `node scripts/secret-scan.mjs`            | Credential scan of tracked files and the client bundle                                              |

### Deploying

1. **Supabase:** create a production project (and a separate one for tests), then apply every file in `supabase/migrations/` in order (`supabase link` and `supabase db push`, or paste them into the SQL editor).
2. **Auth settings:** enable email confirmations, set the Site URL and explicit redirect URLs (`https://YOUR-DOMAIN/auth/callback`), configure production SMTP and test verification and recovery emails, set a minimum password length of 10, and keep "Allow new users to sign up" on.
3. **Storage:** confirm the private `resumes` bucket exists and is **not** public.
4. **Vercel:** import the repo and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `REGISTRATION_MODE` (`public` by default), `SUPPORT_EMAIL`, `RATE_LIMIT_SALT`, `TERMS_VERSION`. Do **not** add `SUPABASE_SECRET_KEY` or `DISCOVERY_DATABASE_URL`.
5. **GitHub Actions secrets:** `DISCOVERY_DATABASE_URL` (listing discovery, the `discovery_ingest` role) and `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (account lifecycle). The daily workflow in `.github/workflows/discovery.yml` refreshes the shared catalog.
6. **First administrator** (signup never grants admin), in the SQL editor:
   ```sql
   insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
   ```

**Pausing signups:** set `REGISTRATION_MODE=closed_pilot` **and** turn off "Allow new users to sign up" in Supabase Auth. Both must agree; hiding the form alone is not a pause.

**Operations:** set budget alerts at 70 / 90 / 100 % in Vercel, Supabase and GitHub; export before destructive migrations (free plans do not guarantee backups); the admin **Runs** tab shows capacity and stale deletion requests.

### How it works

```
Browser → Next.js on Vercel → Supabase Auth / Postgres / Storage
GitHub Actions → TypeScript adapters → restricted ingestion RPC → Postgres
```

- **Ownership is enforced in the database.** Every private table carries `user_id`, and row-level security requires `auth.uid() = user_id` and an active, email-verified account. Admins have no policy that reads private rows.
- **Atomic writes go through RPCs** (`create_application`, `change_application_status`, `commit_import_batch`, and others). Clients cannot write `status`, `revision`, history, quotas, roles or account state directly.
- **Discovery is shared and runs off-device.** One scheduled run serves everyone; eligibility and scoring are computed per request from the user's own profile, and nothing personalized is cached across users.

### Testing and status

Lint, typecheck, build, secret scan and 370+ Vitest tests pass locally. Database behavior is tested on embedded Postgres (PGlite) with stubbed Supabase `auth`/`storage` schemas, which is not a substitute for running the suite against a real Supabase project. Not yet verified end to end: signed-in Playwright flows, real email delivery, live GitHub Actions discovery runs, an assistive-technology accessibility audit, and load testing against real Supabase.
