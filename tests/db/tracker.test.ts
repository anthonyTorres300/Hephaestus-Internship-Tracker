import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, rejects, type Db } from "./harness";

let db: Db;
let u: string;
const rpc = <T = any>(sql: string, params: unknown[] = [], uid = u) =>
  as(db, { uid }, async () => (await db.query<{ r: T }>(sql, params)).rows[0].r);
const create = (extra: Record<string, unknown> = {}, key?: string) =>
  rpc<any>("select public.create_application($1::jsonb, $2) r", [
    JSON.stringify({ company_name: "Acme", role_title: "SWE Intern", ...extra }),
    key ?? null,
  ]);

beforeAll(async () => {
  db = await createDb();
  u = await createUser(db, "u@example.test");
});

describe("AC-03 application status + timeline", () => {
  it("creates prepared application with one creation event and no submission facts (AC-04)", async () => {
    const a = await create({ company_name: "Pinterest", status: "prepared" });
    expect(a).toMatchObject({ status: "prepared", submitted_precision: "unknown", submission_attested: false, revision: 1 });
    const ev = await as(db, { uid: u }, () =>
      db.query<any>("select old_status,new_status,origin from public.application_status_events where application_id=$1", [a.id]),
    );
    expect(ev.rows).toEqual([{ old_status: null, new_status: "prepared", origin: "manual" }]);
    const submitted = await as(db, { uid: u }, () =>
      db.query<any>("select count(*)::int n from public.applications where status not in ('saved','prepared')"),
    );
    expect(submitted.rows[0].n).toBe(0);
  });

  it("requires attestation and a date (or unknown flag) to enter a submitted status", async () => {
    expect(await rejects(create({ status: "applied" }))).toMatch(/attestation_required/);
    expect(await rejects(create({ status: "applied", attested: true }))).toMatch(/submission_date_required/);
    const ok = await create({
      status: "applied",
      attested: true,
      submitted_precision: "day",
      submitted_year: 2026,
      submitted_month: 10,
      submitted_day: 9,
    });
    expect(ok).toMatchObject({ status: "applied", submitted_day: 9, submission_attested: true });
    const unk = await create({ status: "applied", attested: true, submission_date_unknown: true });
    expect(unk).toMatchObject({ submitted_precision: "unknown", submission_date_unknown: true });
  });

  it("rejects impossible calendar dates at the database level", async () => {
    const msg = await rejects(
      create({
        status: "applied",
        attested: true,
        submitted_precision: "day",
        submitted_year: 2026,
        submitted_month: 2,
        submitted_day: 30,
      }),
    );
    expect(msg).toMatch(/applications_submitted_date_parts/);
  });

  it("changes status twice then reopens with a reason; timeline agrees with current status", async () => {
    let a = await create({ status: "prepared" });
    a = await rpc("select public.change_application_status($1, $2, 'applied', null, null, true, $3::jsonb) r", [
      a.id,
      a.revision,
      JSON.stringify({ precision: "day", year: 2026, month: 10, day: 1 }),
    ]);
    a = await rpc("select public.change_application_status($1, $2, 'rejected', 'recruiter email') r", [a.id, a.revision]);
    expect(await rejects(rpc("select public.change_application_status($1, $2, 'interview') r", [a.id, a.revision]))).toMatch(
      /reason_required/,
    );
    a = await rpc("select public.change_application_status($1, $2, 'interview', 'they re-opened it') r", [a.id, a.revision]);
    const ev = await as(db, { uid: u }, () =>
      db.query<any>(
        "select old_status,new_status,origin,reason from public.application_status_events where application_id=$1 order by recorded_at, new_status",
        [a.id],
      ),
    );
    expect(ev.rows.length).toBe(4);
    const last = ev.rows.find((r: any) => r.new_status === "interview");
    expect(last).toMatchObject({ old_status: "rejected", origin: "reopen", reason: "they re-opened it" });
    expect(a.status).toBe("interview");
  });

  it("same-status change writes no event; stale revision conflicts; cannot un-submit", async () => {
    const a = await create({ status: "prepared" });
    const same = await rpc<any>("select public.change_application_status($1, $2, 'prepared') r", [a.id, a.revision]);
    expect(same.revision).toBe(a.revision);
    const n = await as(db, { uid: u }, () =>
      db.query<any>("select count(*)::int n from public.application_status_events where application_id=$1", [a.id]),
    );
    expect(n.rows[0].n).toBe(1);
    const b = await rpc<any>(
      "select public.change_application_status($1, $2, 'applied', null, null, true, '{\"precision\":\"unknown\"}'::jsonb, true) r",
      [a.id, a.revision],
    );
    expect(await rejects(rpc("select public.change_application_status($1, $2, 'screening') r", [a.id, a.revision]))).toMatch(
      /revision_conflict/,
    );
    expect(await rejects(rpc("select public.change_application_status($1, $2, 'prepared') r", [a.id, b.revision]))).toMatch(
      /cannot move a submitted/,
    );
  });

  it("is idempotent for retried create and status change", async () => {
    const a1 = await create({ company_name: "Idem" }, "key-12345678");
    const a2 = await create({ company_name: "Idem" }, "key-12345678");
    expect(a2.id).toBe(a1.id);
    const b = await rpc<any>(
      "select public.change_application_status($1,$2,'applied',null,null,true,'{\"precision\":\"unknown\"}'::jsonb,true,'k-status-1') r",
      [a1.id, a1.revision],
    );
    const retry = await rpc<any>(
      "select public.change_application_status($1,$2,'applied',null,null,true,'{\"precision\":\"unknown\"}'::jsonb,true,'k-status-1') r",
      [a1.id, a1.revision],
    );
    expect(retry.revision).toBe(b.revision);
  });

  it("direct client writes cannot touch status/revision or insert applications", async () => {
    const a = await create();
    expect(
      await rejects(as(db, { uid: u }, () => db.query<any>("update public.applications set status='offer' where id=$1", [a.id]))),
    ).toMatch(/permission denied/);
    expect(
      await rejects(
        as(db, { uid: u }, () =>
          db.query<any>("insert into public.applications (user_id,company_name,role_title,status) values ($1,'x','y','prepared')", [u]),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(await rejects(as(db, { uid: u }, () => db.query<any>("delete from public.application_status_events")))).toMatch(
      /permission denied/,
    );
    const ok = await as(db, { uid: u }, () =>
      db.query<any>("update public.applications set priority='high' where id=$1 and revision=$2 returning revision", [a.id, a.revision]),
    );
    expect(ok.rows[0].revision).toBe(a.revision + 1);
    const stale = await as(db, { uid: u }, () =>
      db.query<any>("update public.applications set priority='low' where id=$1 and revision=$2", [a.id, a.revision]),
    );
    expect(stale.affectedRows).toBe(0);
  });

  it("offer status leaves durable offer evidence that survives later status changes", async () => {
    let a = await create({ status: "applied", attested: true, submission_date_unknown: true });
    a = await rpc("select public.change_application_status($1,$2,'offer') r", [a.id, a.revision]);
    a = await rpc("select public.change_application_status($1,$2,'withdrawn','declined') r", [a.id, a.revision]);
    const o = await as(db, { uid: u }, () => db.query<any>("select date_unknown from public.offer_events where application_id=$1", [a.id]));
    expect(o.rows).toEqual([{ date_unknown: true }]);
  });

  it("trash → restore → permanent delete only from trash, cascading child history", async () => {
    const a = await create();
    expect((await as(db, { uid: u }, () => db.query<any>("delete from public.applications where id=$1", [a.id]))).affectedRows).toBe(0);
    await as(db, { uid: u }, () => db.query<any>("update public.applications set trashed_at=now() where id=$1", [a.id]));
    await as(db, { uid: u }, () => db.query<any>("update public.applications set trashed_at=null where id=$1", [a.id]));
    await as(db, { uid: u }, () => db.query<any>("update public.applications set trashed_at=now() where id=$1", [a.id]));
    expect((await as(db, { uid: u }, () => db.query<any>("delete from public.applications where id=$1", [a.id]))).affectedRows).toBe(1);
    const ev = await db.query<any>("select count(*)::int n from public.application_status_events where application_id=$1", [a.id]);
    expect(ev.rows[0].n).toBe(0);
  });
});

describe("AC-05 tasks and audit", () => {
  it("audits create/complete/snooze and completion is idempotent", async () => {
    const t = await as(
      db,
      { uid: u },
      async () =>
        (
          await db.query<any>(
            "insert into public.tasks (user_id,kind,due_date,timezone) values ($1,'follow_up','2026-10-12','America/Puerto_Rico') returning id",
            [u],
          )
        ).rows[0] as { id: string },
    );
    await as(db, { uid: u }, () => db.query<any>("update public.tasks set due_date='2026-10-20' where id=$1", [t.id]));
    await as(db, { uid: u }, () => db.query<any>("update public.tasks set state='completed' where id=$1 and state='pending'", [t.id]));
    const completedAt = (await db.query<any>("select completed_at from public.tasks where id=$1", [t.id])).rows[0].completed_at;
    await as(db, { uid: u }, () => db.query<any>("update public.tasks set state='completed' where id=$1", [t.id]));
    expect((await db.query<any>("select completed_at from public.tasks where id=$1", [t.id])).rows[0].completed_at).toEqual(completedAt);
    const ev = await db.query<any>("select action from public.task_events where task_id=$1 order by recorded_at, action", [t.id]);
    expect(ev.rows.map((r: any) => r.action).sort()).toEqual(["completed", "created", "snoozed"]);
  });

  it("requires exactly one of due_date / due_at and cannot forge completed_at", async () => {
    expect(
      await rejects(as(db, { uid: u }, () => db.query<any>("insert into public.tasks (user_id,kind) values ($1,'review')", [u]))),
    ).toMatch(/check/);
    expect(
      await rejects(
        as(db, { uid: u }, () =>
          db.query<any>("insert into public.tasks (user_id,kind,due_date,due_at) values ($1,'review','2026-01-01',now())", [u]),
        ),
      ),
    ).toMatch(/check/);
    const t = await as(
      db,
      { uid: u },
      async () =>
        (await db.query<any>("insert into public.tasks (user_id,kind,due_at) values ($1,'review',now()) returning id", [u])).rows[0] as {
          id: string;
        },
    );
    expect(
      await rejects(as(db, { uid: u }, () => db.query<any>("update public.tasks set completed_at=now() where id=$1", [t.id]))),
    ).toMatch(/permission denied/);
  });
});

describe("AC-06/07 import commit", () => {
  const stage = async (rows: { raw: any; proposed: any; errors?: any[]; warnings?: any[]; decision?: string }[], hash = "1".repeat(64)) => {
    const b = await as(
      db,
      { uid: u },
      async () =>
        (await db.query<any>("insert into public.import_batches (user_id,file_hash) values ($1,$2) returning id", [u, hash])).rows[0] as {
          id: string;
        },
    );
    for (const [i, r] of rows.entries()) {
      await as(db, { uid: u }, () =>
        db.query<any>(
          "insert into public.import_rows (user_id,batch_id,ordinal,raw_values,proposed,row_fingerprint,errors,warnings,decision) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            u,
            b.id,
            i + 1,
            JSON.stringify(r.raw),
            JSON.stringify(r.proposed),
            `fp${i}`,
            JSON.stringify(r.errors ?? []),
            JSON.stringify(r.warnings ?? []),
            r.decision ?? "pending",
          ],
        ),
      );
    }
    return b.id;
  };
  const good = (company: string, extra: any = {}) => ({
    raw: { c: company },
    proposed: {
      company_name: company,
      role_title: "SWE Intern",
      status: "applied",
      attested: true,
      submitted_precision: "month",
      submitted_year: 2024,
      submitted_month: 9,
      original_status: "Pending",
      original_application_date: "Sept. 2024",
      ...extra,
    },
  });

  it("blocks commit until invalid rows are corrected or skipped, then reconciles totals", async () => {
    const batch = await stage(
      [
        good("Lockheed"),
        good("Lockheed"),
        { raw: {}, proposed: {}, errors: [{ code: "missing_role" }] },
        good("RTX", {
          status: "offer",
          offer: { precision: "unknown", raw: "Yes", needs_review: true },
          interview: { precision: "unknown", raw: "" },
        }),
      ],
      "2".repeat(64),
    );
    expect(await rejects(rpc("select public.commit_import_batch($1) r", [batch]))).toMatch(/unresolved_rows/);
    await as(db, { uid: u }, () => db.query<any>("update public.import_rows set decision='skip' where batch_id=$1 and ordinal=3", [batch]));
    const s = await rpc<any>("select public.commit_import_batch($1) r", [batch]);
    expect(s).toEqual({ created: 3, linked: 0, skipped: 1, failed: 0, total: 4 });
    expect(await rpc("select public.commit_import_batch($1) r", [batch])).toEqual(s); // retry returns same result

    const apps = await as(db, { uid: u }, () =>
      db.query<any>(
        "select company_name,submitted_precision,submitted_year,submitted_month,submitted_day,original_application_date from public.applications where import_batch_id=$1 order by company_name",
        [batch],
      ),
    );
    expect(apps.rows[0]).toMatchObject({
      submitted_precision: "month",
      submitted_month: 9,
      submitted_day: null,
      original_application_date: "Sept. 2024",
    });
    expect(apps.rows.length).toBe(3); // identical Lockheed rows kept as separate applications pending user review
    const ev = await db.query<any>(
      "select count(*)::int n from public.application_status_events e join public.applications a on a.id=e.application_id where a.import_batch_id=$1 and e.origin='import' and e.effective_at is null and e.effective_at_unknown",
      [batch],
    );
    expect(ev.rows[0].n).toBe(3);
    const off = await db.query<any>(
      "select needs_review, raw_value from public.offer_events o join public.applications a on a.id=o.application_id where a.import_batch_id=$1",
      [batch],
    );
    expect(off.rows).toEqual([{ needs_review: true, raw_value: "Yes" }]);
  });

  it("requires explicit decisions for blocking possible-duplicate warnings and counts failures", async () => {
    const dup = good("Dup");
    const batch = await stage(
      [{ ...dup, warnings: [{ type: "possible_duplicate", blocking: true }] }, good("Bad", { submitted_month: 13 })],
      "3".repeat(64),
    );
    expect(await rejects(rpc("select public.commit_import_batch($1) r", [batch]))).toMatch(/unresolved_rows/);
    await as(db, { uid: u }, () =>
      db.query<any>("update public.import_rows set decision='accept' where batch_id=$1 and ordinal=1", [batch]),
    );
    const s = await rpc<any>("select public.commit_import_batch($1) r", [batch]);
    expect(s).toMatchObject({ created: 1, failed: 1, total: 2 });
  });

  it("undo trashes only unchanged created records", async () => {
    const batch = await stage([good("U1"), good("U2")], "4".repeat(64));
    await rpc("select public.commit_import_batch($1) r", [batch]);
    const edited = (
      await db.query<any>("select id, revision from public.applications where company_name='U2' and import_batch_id=$1", [batch])
    ).rows[0] as any;
    await as(db, { uid: u }, () => db.query<any>("update public.applications set priority='high' where id=$1", [edited.id]));
    const r = await rpc<any>("select public.undo_import_batch($1) r", [batch]);
    expect(r).toEqual({ trashed: 1, kept_for_review: 1 });
    const left = await db.query<any>("select company_name from public.applications where import_batch_id=$1 and trashed_at is null", [
      batch,
    ]);
    expect(left.rows).toEqual([{ company_name: "U2" }]);
  });

  it("limits import previews to 5/hour/account even via direct inserts", async () => {
    const x = await createUser(db, "x@example.test");
    for (let i = 0; i < 5; i++)
      await as(db, { uid: x }, () =>
        db.query<any>("insert into public.import_batches (user_id,file_hash) values ($1,$2)", [x, String(i).repeat(64)]),
      );
    expect(
      await rejects(
        as(db, { uid: x }, () =>
          db.query<any>("insert into public.import_batches (user_id,file_hash) values ($1,$2)", [x, "9".repeat(64)]),
        ),
      ),
    ).toMatch(/rate_limited/);
  });

  it("enforces the 2,000 application quota atomically on import", async () => {
    const q = await createUser(db, "q@example.test");
    await db.query<any>(
      `insert into public.applications (user_id, company_name, role_title, status)
                    select $1, 'c' || g, 'r', 'prepared' from generate_series(1, 1999) g`,
      [q],
    );
    const b = await as(
      db,
      { uid: q },
      async () =>
        (await db.query<any>("insert into public.import_batches (user_id,file_hash) values ($1,$2) returning id", [q, "7".repeat(64)]))
          .rows[0] as { id: string },
    );
    for (const i of [1, 2])
      await as(db, { uid: q }, () =>
        db.query<any>(
          "insert into public.import_rows (user_id,batch_id,ordinal,raw_values,proposed,row_fingerprint) values ($1,$2,$3,'{}',$4,'f')",
          [q, b.id, i, JSON.stringify({ company_name: "n" + i, role_title: "r", status: "prepared" })],
        ),
      );
    expect(await rejects(rpc("select public.commit_import_batch($1) r", [b.id], q))).toMatch(/quota_exceeded/);
    expect(
      await rejects(
        rpc('select public.create_application(\'{"company_name":"a","role_title":"b"}\') r', [], q).then(() =>
          rpc('select public.create_application(\'{"company_name":"a","role_title":"b"}\') r', [], q),
        ),
      ),
    ).toMatch(/quota_exceeded/);
  });
});

describe("practice quotas and ownership", () => {
  it("attempts must reference the user's own problem and respect the cap trigger", async () => {
    const p = await as(
      db,
      { uid: u },
      async () =>
        (await db.query<any>("insert into public.practice_problems (user_id,title,slug) values ($1,'Two Sum','two-sum') returning id", [u]))
          .rows[0] as { id: string },
    );
    await as(db, { uid: u }, () =>
      db.query<any>("insert into public.practice_attempts (user_id,problem_id,result) values ($1,$2,'solved_independently')", [u, p.id]),
    );
    const other = await createUser(db, "other@example.test");
    expect(
      await rejects(
        as(db, { uid: other }, () =>
          db.query<any>("insert into public.practice_attempts (user_id,problem_id,result) values ($1,$2,'unsolved')", [other, p.id]),
        ),
      ),
    ).toMatch(/foreign key/);
    expect(
      await rejects(
        as(db, { uid: u }, () =>
          db.query<any>("insert into public.practice_problems (user_id,title,slug) values ($1,'dup','two-sum')", [u]),
        ),
      ),
    ).toMatch(/duplicate key/);
    expect(
      await rejects(
        as(db, { uid: u }, () =>
          db.query<any>("insert into public.practice_attempts (user_id,problem_id,result,duration_minutes) values ($1,$2,'unsolved',500)", [
            u,
            p.id,
          ]),
        ),
      ),
    ).toMatch(/check/);
  });
});

describe("custom seasons", () => {
  let other: string;
  beforeAll(async () => {
    other = await createUser(db, "other-seasons@example.test");
  });
  const asU = <T = any>(sql: string, params: unknown[] = [], uid = u) => as(db, { uid }, async () => (await db.query<T>(sql, params)).rows);

  it("accepts any season name on an application and counts it per season", async () => {
    await create({ company_name: "A", season: "summer", season_year: 2026 });
    await create({ company_name: "B", season: "co-op", season_year: 2026 });
    await create({ company_name: "C", season: "co-op", season_year: 2026 });
    const rows = await asU<any>(
      "select season, season_year, n from public.application_season_counts where season_year = 2026 order by season",
    );
    expect(rows).toEqual([
      { season: "co-op", season_year: 2026, n: 2 },
      { season: "summer", season_year: 2026, n: 1 },
    ]);
  });

  it("keeps seasons private to their owner and rejects bad names", async () => {
    await asU("insert into public.user_seasons (user_id, name, year) values ($1, 'fall', 2030)", [u]);
    expect((await asU<any>("select name from public.user_seasons where name = 'fall'", [], other)).length).toBe(0);
    expect(await rejects(asU("insert into public.user_seasons (user_id, name, year) values ($1, 'Fall', 2030)", [u]))).toMatch(
      /check|violates/,
    );
    expect(await rejects(asU("insert into public.user_seasons (user_id, name, year) values ($1, 'x', 2030)", [other], u))).toMatch(
      /row-level security/,
    );
  });

  it("caps custom seasons at 40 per account", async () => {
    for (let y = 2031; y < 2031 + 39; y++)
      await asU("insert into public.user_seasons (user_id, name, year) values ($1, 'cap', $2)", [u, y]);
    expect(await rejects(asU("insert into public.user_seasons (user_id, name, year) values ($1, 'cap', 2099)", [u]))).toMatch(
      /quota_exceeded/,
    );
  });
});
