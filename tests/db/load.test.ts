import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, type Db } from "./harness";

// Bounded capacity check on embedded Postgres: 100 synthetic accounts, one heavy account (500 applications,
// 2,000 attempts) and a 2,000-job shared catalog. It validates query shape/indexes, not production latency.
let db: Db;
let heavy: string;
const users: string[] = [];

beforeAll(async () => {
  db = await createDb();
  for (let i = 0; i < 100; i++) users.push(await createUser(db, `load${i}@example.test`));
  heavy = users[0];
  await db.query(
    `insert into public.applications (user_id, company_name, role_title, status, season, season_year, submitted_precision, submitted_year, submitted_month, submitted_day, submission_attested)
     select $1, 'Company ' || g, 'Intern ' || (g % 17), case when g % 3 = 0 then 'prepared' else 'applied' end, 'summer', 2025 + (g % 3),
            case when g % 3 = 0 then 'unknown' else 'day' end, case when g % 3 = 0 then null else 2026 end, case when g % 3 = 0 then null else 1 + (g % 12) end,
            case when g % 3 = 0 then null else 1 + (g % 28) end, g % 3 <> 0
     from generate_series(1, 500) g`,
    [heavy],
  );
  for (const u of users.slice(1)) {
    await db.query(
      `insert into public.applications (user_id, company_name, role_title, status) select $1, 'C' || g, 'R', 'prepared' from generate_series(1, 5) g`,
      [u],
    );
  }
  await db.query(
    `insert into public.practice_problems (user_id, title, slug) select $1, 'Problem ' || g, 'problem-' || g from generate_series(1, 400) g`,
    [heavy],
  );
  await db.query(
    `insert into public.practice_attempts (user_id, problem_id, practiced_at, result, confidence)
     select $1, p.id, now() - (g || ' hours')::interval, case when g % 2 = 0 then 'solved_independently' else 'unsolved' end, 1 + (g % 5)
     from generate_series(1, 2000) g join lateral (select id from public.practice_problems where user_id = $1 order by id offset (g % 400) limit 1) p on true`,
    [heavy],
  );
  await db.query(
    `insert into public.jobs (company, title, season, season_year, locations, identity_key, candidate_key, search_text)
     select 'Co' || g, 'Intern', 'summer', 2027, '["Remote"]', 'k' || g, 'c' || g, 'co' || g || ' intern' from generate_series(1, 2000) g`,
  );
});

const timed = async <T>(fn: () => Promise<T>) => {
  const t = performance.now();
  const r = await fn();
  return { r, ms: performance.now() - t };
};

describe("bounded load check (targets: ordinary reads under 2s)", () => {
  it("paginated, filtered application search stays fast and isolated", async () => {
    const { r, ms } = await timed(() =>
      as(db, { uid: heavy }, () =>
        db.query<any>(
          `select * from public.applications where trashed_at is null and archived_at is null and season_year = 2026 and search_text like '%company 1%' order by updated_at desc, id limit 25`,
        ),
      ),
    );
    expect(r.rows.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
    const other = await as(db, { uid: users[50] }, () => db.query<any>("select count(*)::int n from public.applications"));
    expect(other.rows[0].n).toBe(5);
  });

  it("loading all attempts and the shared catalog for one user stays under the target", async () => {
    const a = await timed(() => as(db, { uid: heavy }, () => db.query<any>("select count(*)::int n from public.practice_attempts")));
    expect(a.r.rows[0].n).toBe(2000);
    const j = await timed(() =>
      as(db, { uid: users[7] }, () =>
        db.query<any>("select * from public.jobs where superseded_by is null order by first_seen_at desc limit 2000"),
      ),
    );
    expect(j.r.rows.length).toBe(2000);
    expect(a.ms).toBeLessThan(2000);
    expect(j.ms).toBeLessThan(2000);
  });

  it("10 interleaved active users each see only their own data", async () => {
    for (let round = 0; round < 3; round++) {
      for (const u of users.slice(0, 10)) {
        const n = await as(db, { uid: u }, async () => (await db.query<any>("select count(*)::int n from public.applications")).rows[0].n);
        expect(n).toBe(u === heavy ? 500 : 5);
      }
    }
  });
});
