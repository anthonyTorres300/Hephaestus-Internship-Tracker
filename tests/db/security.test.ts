import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, grantAdmin, rejects, type Db } from "./harness";

let db: Db;
let alice: string, bob: string, admin: string, unverified: string, suspended: string;
let aliceApp: string;

const newApp = (db: Db, uid: string, extra: Record<string, unknown> = {}) =>
  as(db, { uid }, async () => {
    const r = await db.query<{ r: { id: string } }>("select public.create_application($1::jsonb) as r", [
      JSON.stringify({ company_name: "Acme", role_title: "SWE Intern", status: "prepared", ...extra }),
    ]);
    return r.rows[0].r.id;
  });

beforeAll(async () => {
  db = await createDb();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  admin = await createUser(db, "admin@example.test");
  unverified = await createUser(db, "unverified@example.test", { verified: false });
  suspended = await createUser(db, "suspended@example.test");
  await grantAdmin(db, admin);
  await db.query<any>("update public.account_states set state = 'suspended' where user_id = $1", [suspended]);
  aliceApp = await newApp(db, alice);
  await as(db, { uid: alice }, () =>
    db.query<any>("insert into public.application_notes (user_id, application_id, body) values ($1, $2, 'private note')", [
      alice,
      aliceApp,
    ]),
  );
});

const count = (uid: string | null, table: string) =>
  as(db, { uid }, async () => (await db.query<{ n: number }>(`select count(*)::int n from public.${table}`)).rows[0].n);

describe("AC-02 isolation", () => {
  it("each user only sees their own rows", async () => {
    expect(await count(alice, "applications")).toBe(1);
    expect(await count(bob, "applications")).toBe(0);
    expect(await count(bob, "application_notes")).toBe(0);
    expect(await count(bob, "profiles")).toBe(1);
  });

  it("anonymous clients have no table access at all", async () => {
    expect(await rejects(as(db, { uid: null }, () => db.query<any>("select * from public.applications")))).toMatch(/permission denied/);
    expect(await rejects(as(db, { uid: null }, () => db.query<any>("select * from public.jobs")))).toMatch(/permission denied/);
  });

  it("unverified and suspended accounts see nothing, even with a valid session", async () => {
    for (const t of ["profiles", "jobs", "dsa_topics"]) {
      expect(await count(unverified, t)).toBe(0);
      expect(await count(suspended, t)).toBe(0);
    }
    expect(await rejects(newApp(db, unverified))).toMatch(/forbidden/);
    expect(await rejects(newApp(db, suspended))).toMatch(/forbidden/);
  });

  it("administrators cannot read another user's private data", async () => {
    expect(await count(admin, "applications")).toBe(0);
    expect(await count(admin, "application_notes")).toBe(0);
    expect(await count(admin, "profiles")).toBe(1);
  });

  it("cannot attach children to another user's parent, even with a guessed id", async () => {
    const msg = await rejects(
      as(db, { uid: bob }, () =>
        db.query<any>("insert into public.application_notes (user_id, application_id, body) values ($1, $2, 'x')", [bob, aliceApp]),
      ),
    );
    expect(msg).toMatch(/foreign key|violates/);
  });

  it("cannot insert rows claiming another owner", async () => {
    expect(
      await rejects(
        as(db, { uid: bob }, () =>
          db.query<any>("insert into public.tasks (user_id, kind, due_date) values ($1, 'review', '2027-01-01')", [alice]),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("cannot update or delete another user's rows", async () => {
    const upd = await as(db, { uid: bob }, () =>
      db.query<any>("update public.applications set priority = 'low' where id = $1", [aliceApp]),
    );
    expect(upd.affectedRows).toBe(0);
    const del = await as(db, { uid: bob }, () => db.query<any>("delete from public.applications where id = $1", [aliceApp]));
    expect(del.affectedRows).toBe(0);
  });

  it("RPCs refuse foreign ids with 404 semantics", async () => {
    const msg = await rejects(
      as(db, { uid: bob }, () => db.query<any>("select public.change_application_status($1, 1, 'screening')", [aliceApp])),
    );
    expect(msg).toMatch(/not found/);
  });

  it("same checksum and import hash in two accounts never collide", async () => {
    const sha = "a".repeat(64);
    for (const uid of [alice, bob]) {
      await as(db, { uid }, async () => {
        const r = await db.query<{ r: { status: string } }>(
          "select public.reserve_resume_upload('R','r.pdf','application/pdf',1000,$1) r",
          [sha],
        );
        expect(r.rows[0].r.status).toBe("reserved");
        await db.query<any>("insert into public.import_batches (user_id, file_hash) values ($1, $2)", [uid, sha]);
      });
    }
  });
});

describe("AC-21/24 roles, state and counters", () => {
  it("users cannot grant themselves roles, edit account state or counters", async () => {
    expect(
      await rejects(as(db, { uid: bob }, () => db.query<any>("insert into public.user_roles (user_id, role) values ($1, 'admin')", [bob]))),
    ).toMatch(/permission denied/);
    expect(
      await rejects(
        as(db, { uid: bob }, () => db.query<any>("update public.account_states set state = 'active' where user_id = $1", [bob])),
      ),
    ).toMatch(/permission denied/);
    expect(
      await rejects(
        as(db, { uid: bob }, () =>
          db.query<any>("insert into public.usage_counters (user_id, quota_type, window_start) values ($1,'x',now())", [bob]),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await rejects(
        as(db, { uid: bob }, () => db.query<any>("update public.profiles set profile_revision = 99 where user_id = $1", [bob])),
      ),
    ).toMatch(/permission denied/);
  });

  it("ordinary users cannot call admin RPCs or read run diagnostics", async () => {
    expect(
      await rejects(as(db, { uid: bob }, () => db.query<any>("select public.admin_set_account_state($1,'suspended')", [alice]))),
    ).toMatch(/forbidden/);
    expect(await rejects(as(db, { uid: bob }, () => db.query<any>("select public.admin_claim_refresh(gen_random_uuid())")))).toMatch(
      /forbidden/,
    );
    expect(await count(bob, "discovery_runs")).toBe(0);
    expect(await count(bob, "job_sources")).toBe(0);
    expect(await count(admin, "job_sources")).toBe(0); // none seeded, but readable by admin
  });

  it("admin suspension takes effect immediately for an existing session and is audited", async () => {
    const carol = await createUser(db, "carol@example.test");
    expect(await count(carol, "profiles")).toBe(1);
    await as(db, { uid: admin }, () => db.query<any>("select public.admin_set_account_state($1,'suspended','abuse')", [carol]));
    expect(await count(carol, "profiles")).toBe(0);
    expect(await rejects(newApp(db, carol))).toMatch(/forbidden/);
    const audit = await as(db, { uid: admin }, () =>
      db.query<any>("select action from public.admin_audit_events where target_id = $1", [carol]),
    );
    expect(audit.rows).toEqual([{ action: "account_suspended" }]);
    expect(await rejects(as(db, { uid: admin }, () => db.query<any>("update public.admin_audit_events set action = 'x'")))).toMatch(
      /permission denied/,
    );
  });

  it("admin cannot suspend self; suspended users cannot upload (storage layer)", async () => {
    expect(
      await rejects(as(db, { uid: admin }, () => db.query<any>("select public.admin_set_account_state($1,'suspended')", [admin]))),
    ).toMatch(/own account/);
    const dave = await createUser(db, "dave@example.test");
    const rid = await as(
      db,
      { uid: dave },
      async () =>
        (
          await db.query<{ r: { storage_path: string } }>("select public.reserve_resume_upload('R','d.pdf','application/pdf',10,$1) r", [
            "b".repeat(64),
          ])
        ).rows[0].r.storage_path,
    );
    await db.query<any>("update public.account_states set state='suspended' where user_id = $1", [dave]);
    expect(
      await rejects(
        as(db, { uid: dave }, () =>
          db.query<any>("insert into storage.objects (bucket_id, name, owner) values ('resumes', $1, $2)", [rid, dave]),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("durable rate limit returns false once the bucket is exhausted", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await as(
          db,
          { uid: null },
          async () =>
            (await db.query<{ ok: boolean }>("select public.rate_limit_public('resend', $1, 3, 900) ok", ["f".repeat(32)])).rows[0].ok,
        ),
      );
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("AC-22 resume storage", () => {
  it("storage objects require a matching pending reservation and an owner path", async () => {
    const erin = await createUser(db, "erin@example.test");
    const res = await as(
      db,
      { uid: erin },
      async () =>
        (
          await db.query<{ r: { resume_id: string; storage_path: string } }>(
            "select public.reserve_resume_upload('R','e.pdf','application/pdf',10,$1) r",
            ["c".repeat(64)],
          )
        ).rows[0].r,
    );
    // someone else's folder / unreserved path
    expect(
      await rejects(
        as(db, { uid: bob }, () => db.query<any>("insert into storage.objects (bucket_id,name) values ('resumes',$1)", [res.storage_path])),
      ),
    ).toMatch(/row-level security/);
    expect(
      await rejects(
        as(db, { uid: erin }, () =>
          db.query<any>("insert into storage.objects (bucket_id,name) values ('resumes',$1)", [`${erin}/${crypto.randomUUID()}/x.pdf`]),
        ),
      ),
    ).toMatch(/row-level security/);
    await as(db, { uid: erin }, () =>
      db.query<any>("insert into storage.objects (bucket_id,name,metadata) values ('resumes',$1,'{\"size\":10}')", [res.storage_path]),
    );
    await as(db, { uid: erin }, () => db.query<any>("select public.finalize_resume_upload($1)", [res.resume_id]));
    // ready file is readable by owner only
    const mine = await as(db, { uid: erin }, () => db.query<any>("select name from storage.objects where bucket_id='resumes'"));
    const theirs = await as(db, { uid: bob }, () => db.query<any>("select name from storage.objects where bucket_id='resumes'"));
    expect(mine.rows.length).toBe(1);
    expect(theirs.rows.length).toBe(0);
    // immutable: no update policy
    const upd = await as(db, { uid: erin }, () => db.query<any>("update storage.objects set name = name || 'x' where bucket_id='resumes'"));
    expect(upd.affectedRows).toBe(0);
  });

  it("size mismatch fails finalize; duplicate checksum prompts reuse", async () => {
    const f = await createUser(db, "frank@example.test");
    const sha = "d".repeat(64);
    const r1 = await as(
      db,
      { uid: f },
      async () =>
        (await db.query<{ r: any }>("select public.reserve_resume_upload('R','f.pdf','application/pdf',10,$1) r", [sha])).rows[0].r,
    );
    await as(db, { uid: f }, () =>
      db.query<any>("insert into storage.objects (bucket_id,name,metadata) values ('resumes',$1,'{\"size\":999}')", [r1.storage_path]),
    );
    expect(await rejects(as(db, { uid: f }, () => db.query<any>("select public.finalize_resume_upload($1)", [r1.resume_id])))).toMatch(
      /size_mismatch/,
    );
    const r2 = await as(
      db,
      { uid: f },
      async () =>
        (await db.query<{ r: any }>("select public.reserve_resume_upload('R2','f.pdf','application/pdf',10,$1) r", [sha])).rows[0].r,
    );
    await as(db, { uid: f }, () =>
      db.query<any>("insert into storage.objects (bucket_id,name,metadata) values ('resumes',$1,'{\"size\":10}')", [r2.storage_path]),
    );
    await as(db, { uid: f }, () => db.query<any>("select public.finalize_resume_upload($1)", [r2.resume_id]));
    const dup = await as(
      db,
      { uid: f },
      async () =>
        (await db.query<{ r: any }>("select public.reserve_resume_upload('R3','f.pdf','application/pdf',10,$1) r", [sha])).rows[0].r,
    );
    expect(dup).toMatchObject({ status: "duplicate", resume_id: r2.resume_id });
  });

  it("enforces per-account byte quota and blocks deleting an in-use version", async () => {
    const g = await createUser(db, "gina@example.test");
    const reserve = (size: number, i: number) =>
      as(db, { uid: g }, () =>
        db.query<any>("select public.reserve_resume_upload('R','g.pdf','application/pdf',$1,$2)", [size, String(i).padStart(64, "0")]),
      );
    for (let i = 0; i < 10; i++) await reserve(10_485_760, i);
    expect(await rejects(reserve(1, 11))).toMatch(/quota_exceeded/);

    const h = await createUser(db, "hank@example.test");
    const r = await as(
      db,
      { uid: h },
      async () =>
        (await db.query<{ r: any }>("select public.reserve_resume_upload('R','h.pdf','application/pdf',10,$1) r", ["e".repeat(64)])).rows[0]
          .r,
    );
    await as(db, { uid: h }, () =>
      db.query<any>("insert into storage.objects (bucket_id,name,metadata) values ('resumes',$1,'{\"size\":10}')", [r.storage_path]),
    );
    await as(db, { uid: h }, () => db.query<any>("select public.finalize_resume_upload($1)", [r.resume_id]));
    const appId = await newApp(db, h, { resume_version_id: r.resume_id });
    expect(await rejects(as(db, { uid: h }, () => db.query<any>("select public.begin_resume_delete($1)", [r.resume_id])))).toMatch(
      /resume_in_use/,
    );
    await as(db, { uid: h }, () => db.query<any>("update public.applications set resume_version_id = null where id = $1", [appId]));
    await as(db, { uid: h }, () => db.query<any>("select public.begin_resume_delete($1)", [r.resume_id]));
    expect(await rejects(as(db, { uid: h }, () => db.query<any>("select public.finish_resume_delete($1)", [r.resume_id])))).toMatch(
      /object_still_present/,
    );
    await as(db, { uid: h }, () => db.query<any>("delete from storage.objects where bucket_id='resumes'"));
    await as(db, { uid: h }, () => db.query<any>("select public.finish_resume_delete($1)", [r.resume_id]));
    expect(await count(h, "resume_versions")).toBe(0);
  });
});

describe("AC-23 account deletion", () => {
  it("blocks access immediately, exposes safe progress, and cascades private rows when the Auth user is removed", async () => {
    const z = await createUser(db, "zed@example.test");
    await newApp(db, z);
    await as(db, { uid: z }, () => db.query<any>("select public.request_account_deletion()"));
    await as(db, { uid: z }, () => db.query<any>("select public.request_account_deletion()")); // idempotent
    expect(await count(z, "applications")).toBe(0);
    expect(await rejects(newApp(db, z))).toMatch(/forbidden/);
    const prog = await as(db, { uid: z }, () => db.query<any>("select state from public.account_deletion_requests"));
    expect(prog.rows).toEqual([{ state: "queued" }]);
    const other = await as(db, { uid: bob }, () => db.query<any>("select * from public.account_deletion_requests"));
    expect(other.rows.length).toBe(0);
    await db.query<any>("delete from auth.users where id = $1", [z]);
    const left = await db.query<any>(
      "select (select count(*) from public.applications where user_id=$1)::int a, (select count(*) from public.profiles where user_id=$1)::int p",
      [z],
    );
    expect(left.rows[0]).toEqual({ a: 0, p: 0 });
    expect(await count(alice, "applications")).toBe(1);
  });
});
