import { beforeEach, describe, expect, it } from "vitest";
import { as, createDb, createUser, grantAdmin, rejects, type Db } from "./harness";

let db: Db;
let sourceA: string, sourceB: string, admin: string, user: string;

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  entry_key: `r${n}`,
  permalink: `https://github.com/o/r/blob/sha/README.md#r${n}`,
  row_hash: `h${n}`,
  company: `Co${n}`,
  title: "SWE Intern",
  role_category: "software",
  season: "summer",
  season_year: 2027,
  locations: ["Remote"],
  apply_url: `https://jobs.example.test/${n}`,
  canonical_url: `https://jobs.example.test/${n}`,
  identity_key: `url:https://jobs.example.test/${n}`,
  candidate_key: `co${n}|swe intern`,
  state: "listed",
  requirements: {},
  ...extra,
});
const rows = (n: number, from = 1) => Array.from({ length: n }, (_, i) => row(from + i));

const run = async () =>
  (await db.query<{ id: string }>("select public.acquire_discovery_lease('manual', gen_random_uuid(), 't') id")).rows[0].id;
const ingest = async (src: string, rs: unknown[], opts: { complete?: boolean; runId?: string } = {}) => {
  const rid = opts.runId ?? (await run());
  const r = await as(db, { role: "discovery_ingest" }, () =>
    db.query<{ r: any }>("select public.ingest_source_snapshot($1,$2,'sha','hash','etag',$3,0,'{}',$4::jsonb) r", [
      rid,
      src,
      opts.complete ?? true,
      JSON.stringify(rs),
    ]),
  );
  await db.query<any>("update public.discovery_runs set state='success', finished_at=now() where id=$1", [rid]);
  return r.rows[0].r;
};
const ageObservations = (hours: number) =>
  db.query<any>("update public.job_observations set first_missing_at = first_missing_at - ($1 || ' hours')::interval", [String(hours)]);

beforeEach(async () => {
  db = await createDb();
  const s = await db.query<{ id: string }>(
    "insert into public.job_sources (repo_owner,repo_name,path,adapter_id,adapter_version) values ('o','a','README.md','simplify','1'),('o','b','README.md','vansh','1') returning id",
  );
  [sourceA, sourceB] = s.rows.map((r) => r.id);
  admin = await createUser(db, "admin@example.test");
  await grantAdmin(db, admin);
  user = await createUser(db, "user@example.test");
});

describe("AC-10 snapshot safety", () => {
  it("first-run empty and incomplete snapshots fail without writing", async () => {
    expect(await ingest(sourceA, [])).toMatchObject({ state: "failed", reason: "empty_snapshot" });
    expect(await ingest(sourceA, rows(3), { complete: false })).toMatchObject({ state: "failed", reason: "incomplete_snapshot" });
    expect((await db.query<any>("select count(*)::int n from public.jobs")).rows[0].n).toBe(0);
    expect(
      (await db.query<any>("select last_success_at from public.job_sources where id=$1", [sourceA])).rows[0].last_success_at,
    ).toBeNull();
  });

  it("holds a snapshot that drops below 50% of baseline and never marks anything missing", async () => {
    await ingest(sourceA, rows(10));
    const held = await ingest(sourceA, rows(4));
    expect(held).toMatchObject({ state: "held_for_review", rows: 4, baseline: 10 });
    expect((await db.query<any>("select count(*)::int n from public.job_observations where state='listed'")).rows[0].n).toBe(10);
    expect(
      (await db.query<any>("select accepted_row_count from public.job_sources where id=$1", [sourceA])).rows[0].accepted_row_count,
    ).toBe(10);
  });

  it("marks missing only after two complete snapshots at least 24h apart, and reappearance recovers", async () => {
    await ingest(sourceA, rows(5));
    await ingest(sourceA, rows(4)); // r5 missing once
    expect((await db.query<any>("select state,missing_count from public.job_observations where entry_key='r5'")).rows[0]).toEqual({
      state: "listed",
      missing_count: 1,
    });
    await ingest(sourceA, rows(4)); // second snapshot < 24h later: still listed
    expect((await db.query<any>("select state from public.job_observations where entry_key='r5'")).rows[0].state).toBe("listed");
    await ageObservations(25);
    await ingest(sourceA, rows(4));
    expect((await db.query<any>("select state from public.job_observations where entry_key='r5'")).rows[0].state).toBe(
      "missing_from_source",
    );
    expect((await db.query<any>("select availability from public.jobs where company='Co5'")).rows[0].availability).toBe(
      "missing_from_source",
    );
    await ingest(sourceA, rows(5));
    expect((await db.query<any>("select state,missing_count from public.job_observations where entry_key='r5'")).rows[0]).toEqual({
      state: "listed",
      missing_count: 0,
    });
  });

  it("failed/partial runs never alter missing state; jobs are never deleted", async () => {
    await ingest(sourceA, rows(5));
    await ingest(sourceA, rows(2), { complete: false });
    await ingest(sourceA, []);
    expect((await db.query<any>("select count(*)::int n from public.job_observations where missing_count > 0")).rows[0].n).toBe(0);
    expect((await db.query<any>("select count(*)::int n from public.jobs")).rows[0].n).toBe(5);
  });

  it("explicit closed marker changes only that observation; another source keeps the job listed", async () => {
    const shared = { identity_key: "ats:greenhouse:acme:42", canonical_url: "https://boards.example.test/acme/42" };
    await ingest(sourceA, [row(1, shared)]);
    await ingest(sourceB, [row(1, { ...shared, entry_key: "b1" })]);
    await ingest(sourceA, [row(1, { ...shared, state: "source_closed", row_hash: "h1-closed" })]);
    expect((await db.query<any>("select count(*)::int n from public.jobs")).rows[0].n).toBe(1);
    const obs = await db.query<any>(
      "select s.repo_name, o.state from public.job_observations o join public.job_sources s on s.id=o.source_id order by 1",
    );
    expect(obs.rows).toEqual([
      { repo_name: "a", state: "source_closed" },
      { repo_name: "b", state: "listed" },
    ]);
    expect((await db.query<any>("select availability from public.jobs")).rows[0].availability).toBe("listed");
    const ev = await db.query<any>("select event_type from public.job_observation_events order by observed_at, event_type");
    expect(ev.rows.map((r: any) => r.event_type)).toContain("closed");
  });
});

describe("AC-09 identity", () => {
  it("same exact job from two feeds = one job, two observations; different requisitions/tenants stay separate", async () => {
    await ingest(sourceA, [
      row(1, { identity_key: "ats:lever:acme:REQ1" }),
      row(2, { identity_key: "ats:lever:acme:REQ2", company: "Co1", title: "SWE Intern" }),
    ]);
    await ingest(sourceB, [
      row(1, { identity_key: "ats:lever:acme:REQ1", entry_key: "x" }),
      row(3, { identity_key: "ats:lever:other:REQ1", company: "Co1", title: "SWE Intern" }),
    ]);
    expect((await db.query<any>("select count(*)::int n from public.jobs")).rows[0].n).toBe(3);
    expect((await db.query<any>("select count(*)::int n from public.job_observations")).rows[0].n).toBe(4);
  });

  it("flags same company/title candidates for admin review without merging", async () => {
    await ingest(sourceA, [
      row(1, { identity_key: "ats:a:1", candidate_key: "same" }),
      row(2, { identity_key: "ats:b:2", candidate_key: "same" }),
    ]);
    expect((await db.query<any>("select count(*)::int n from public.jobs")).rows[0].n).toBe(2);
    expect((await db.query<any>("select count(*)::int n from public.job_merge_candidates where state='open'")).rows[0].n).toBe(1);
  });

  it("admin merge remaps users independently, preserving both saved and hidden, and leaves application snapshots alone", async () => {
    await ingest(sourceA, [
      row(1, { identity_key: "ats:a:1", candidate_key: "same" }),
      row(2, { identity_key: "ats:b:2", candidate_key: "same" }),
    ]);
    const [j1, j2] = (await db.query<{ id: string }>("select id from public.jobs order by company")).rows.map((r) => r.id);
    const bob = await createUser(db, "bob@example.test");
    await as(db, { uid: user }, () => db.query<any>("insert into public.user_jobs (user_id,job_id,saved) values ($1,$2,true)", [user, j1]));
    await as(db, { uid: user }, () =>
      db.query<any>("insert into public.user_jobs (user_id,job_id,hidden) values ($1,$2,true)", [user, j2]),
    );
    await as(db, { uid: bob }, () => db.query<any>("insert into public.user_jobs (user_id,job_id,saved) values ($1,$2,true)", [bob, j2]));
    const app = await as(
      db,
      { uid: user },
      async () =>
        (
          await db.query<{ r: any }>("select public.create_application($1::jsonb) r", [
            JSON.stringify({ company_name: "Co2", role_title: "SWE Intern", job_id: j2 }),
          ])
        ).rows[0].r,
    );

    expect(await rejects(as(db, { uid: user }, () => db.query<any>("select public.admin_merge_jobs($1,$2)", [j1, j2])))).toMatch(
      /forbidden/,
    );
    await as(db, { uid: admin }, () => db.query<any>("select public.admin_merge_jobs($1,$2)", [j1, j2]));
    const mine = await as(db, { uid: user }, () => db.query<any>("select saved, hidden from public.user_jobs"));
    expect(mine.rows).toEqual([{ saved: true, hidden: true }]);
    const theirs = await as(db, { uid: bob }, () => db.query<any>("select job_id, saved, hidden from public.user_jobs"));
    expect(theirs.rows).toEqual([{ job_id: j1, saved: true, hidden: false }]);
    const a = await as(db, { uid: user }, () =>
      db.query<any>("select job_id, company_name from public.applications where id=$1", [app.id]),
    );
    expect(a.rows).toEqual([{ job_id: j1, company_name: "Co2" }]);
    expect((await db.query<any>("select count(*)::int n from public.job_observations where job_id=$1", [j1])).rows[0].n).toBe(2);
    expect((await db.query<any>("select superseded_by from public.jobs where id=$1", [j2])).rows[0].superseded_by).toBe(j1);
    // a later ingest of the merged identity resolves to the surviving job
    await ingest(sourceB, [row(9, { identity_key: "ats:b:2", entry_key: "late" })]);
    expect((await db.query<any>("select count(*)::int n from public.jobs where superseded_by is null")).rows[0].n).toBe(1);
  });
});

describe("AC-17 lease, privileges, held review", () => {
  it("only one run may hold the lease; stale leases expire", async () => {
    const first = await run();
    expect(first).toBeTruthy();
    const second = (await db.query<any>("select public.acquire_discovery_lease('schedule', gen_random_uuid(), 't2') id")).rows[0].id;
    expect(second).toBeNull();
    await db.query<any>("update public.discovery_runs set lease_expires_at = now() - interval '1 minute'");
    expect(await run()).toBeTruthy();
    expect((await db.query<any>("select error_code from public.discovery_runs where id=$1", [first])).rows[0].error_code).toBe(
      "lease_expired",
    );
  });

  it("ingestion role can call only ingestion RPCs, never read private tables", async () => {
    for (const t of ["applications", "profiles", "resume_versions", "jobs"]) {
      expect(await rejects(as(db, { role: "discovery_ingest" }, () => db.query<any>(`select * from public.${t}`)))).toMatch(
        /permission denied/,
      );
    }
    expect(
      await rejects(
        as(db, { role: "discovery_ingest" }, () => db.query<any>("select public.admin_merge_jobs(gen_random_uuid(), gen_random_uuid())")),
      ),
    ).toMatch(/permission denied/);
    expect(
      await rejects(as(db, { role: "discovery_ingest" }, () => db.query<any>("select public.lifecycle_cleanup_operational()"))),
    ).toMatch(/permission denied/);
  });

  it("requires an active lease to ingest", async () => {
    const rid = await run();
    await db.query<any>("update public.discovery_runs set state='failed' where id=$1", [rid]);
    expect(await rejects(ingest(sourceA, rows(2), { runId: rid }))).toMatch(/no active run lease/);
  });

  it("admin approves a held snapshot (audited); ordinary users cannot; users see only sanitized health", async () => {
    await ingest(sourceA, rows(10));
    await ingest(sourceA, rows(3));
    const held = (await db.query<{ id: string }>("select id from public.source_runs where state='held_for_review'")).rows[0].id;
    expect(await rejects(as(db, { uid: user }, () => db.query<any>("select public.admin_resolve_held_snapshot($1,true)", [held])))).toMatch(
      /forbidden/,
    );
    await as(db, { uid: admin }, () => db.query<any>("select public.admin_resolve_held_snapshot($1,true)", [held]));
    expect(
      (await db.query<any>("select accepted_row_count from public.job_sources where id=$1", [sourceA])).rows[0].accepted_row_count,
    ).toBe(3);
    const health = await as(db, { uid: user }, () => db.query<any>("select repository, stale from public.feed_health order by 1"));
    expect(health.rows.length).toBe(2);
    expect((await as(db, { uid: user }, () => db.query<any>("select * from public.source_runs"))).rows.length).toBe(0);
  });

  it("manual refresh claims are cooldown-limited globally and audited", async () => {
    await as(db, { uid: admin }, () => db.query<any>("select public.admin_claim_refresh(gen_random_uuid())"));
    expect(await rejects(as(db, { uid: admin }, () => db.query<any>("select public.admin_claim_refresh(gen_random_uuid())")))).toMatch(
      /cooldown/,
    );
  });

  it("users read shared jobs but cannot write catalog rows", async () => {
    await ingest(sourceA, rows(2));
    expect((await as(db, { uid: user }, () => db.query<any>("select * from public.jobs"))).rows.length).toBe(2);
    expect(await rejects(as(db, { uid: user }, () => db.query<any>("update public.jobs set title='x'")))).toMatch(/permission denied/);
    expect(
      await rejects(
        as(db, { uid: user }, () =>
          db.query<any>(
            "insert into public.job_sources (repo_owner,repo_name,path,adapter_id,adapter_version) values ('x','y','z','a','1')",
          ),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
