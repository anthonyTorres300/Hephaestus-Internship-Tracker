import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { as, createDb, createUser, grantAdmin, rejects, type Db } from "./harness";
import { SOURCES } from "@/lib/discovery/sources";

let db: Db;

const cfg = (n: number, extra: Record<string, unknown> = {}) => ({
  owner: `owner${n}`,
  repo: `repo-${n}`,
  path: "README.md",
  adapterId: "pipe",
  adapterVersion: "1",
  license: "MIT",
  attribution: `Listings from owner${n}/repo-${n}`,
  ...extra,
});
const sync = (sources: unknown, role: "discovery_ingest" | "authenticated" | "anon" = "discovery_ingest") =>
  as(
    db,
    { role },
    async () => (await db.query<{ n: number }>("select public.sync_job_sources($1::jsonb) n", [JSON.stringify(sources)])).rows[0].n,
  );
const rowsOf = async () =>
  (await db.query<any>("select * from public.job_sources order by repo_owner, repo_name, path")).rows as Record<string, any>[];

beforeEach(async () => {
  db = await createDb();
});

describe("sync_job_sources", () => {
  it("inserts new sources enabled with their metadata", async () => {
    expect(await sync([cfg(1), cfg(2, { path: "SUMMER.md", license: "none-declared" })])).toBe(2);
    const r = await rowsOf();
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      repo_owner: "owner1",
      repo_name: "repo-1",
      path: "README.md",
      adapter_id: "pipe",
      adapter_version: "1",
      enabled: true,
      license: "MIT",
      attribution: "Listings from owner1/repo-1",
      accepted_row_count: 0,
    });
    expect(r[1]).toMatchObject({ path: "SUMMER.md", license: "none-declared", enabled: true });
  });

  it("is idempotent and does not touch unchanged rows", async () => {
    await sync([cfg(1), cfg(2)]);
    const before = await rowsOf();
    expect(await sync([cfg(1), cfg(2)])).toBe(0);
    expect(await rowsOf()).toEqual(before);
  });

  it("never re-enables a source an admin disabled", async () => {
    await sync([cfg(1)]);
    const admin = await createUser(db, "admin@example.test");
    await grantAdmin(db, admin);
    const id = (await rowsOf())[0].id;
    await as(db, { uid: admin }, () => db.query("select public.admin_set_source_enabled($1, false)", [id]));
    expect((await rowsOf())[0].enabled).toBe(false);
    await sync([cfg(1), cfg(2)]);
    const r = await rowsOf();
    expect(r.find((x) => x.repo_name === "repo-1")!.enabled).toBe(false);
    expect(r.find((x) => x.repo_name === "repo-2")!.enabled).toBe(true);
    expect((await db.query<any>("select count(*)::int n from public.get_enabled_sources()")).rows[0].n).toBe(1);
  });

  it("keeps existing license/attribution/branch/version and fills only null values", async () => {
    await db.query(
      "insert into public.job_sources (repo_owner, repo_name, path, adapter_id, adapter_version, license, attribution) values ('owner1','repo-1','README.md','pipe','1','Apache-2.0', null)",
    );
    await sync([cfg(1, { license: "MIT", attribution: "new attribution", adapterVersion: "9", defaultBranch: "dev" })]);
    expect((await rowsOf())[0]).toMatchObject({
      license: "Apache-2.0",
      attribution: "new attribution",
      adapter_version: "1",
      default_branch: "dev",
    });
    await sync([cfg(1, { license: "GPL", attribution: "other", defaultBranch: "main" })]);
    expect((await rowsOf())[0]).toMatchObject({ license: "Apache-2.0", attribution: "new attribution", default_branch: "dev" });
  });

  it("keeps ingestion state on existing rows", async () => {
    await sync([cfg(1)]);
    await db.query("update public.job_sources set accepted_row_count = 42, etag = 'e', last_commit_sha = 'abc'");
    await sync([cfg(1)]);
    expect((await rowsOf())[0]).toMatchObject({ accepted_row_count: 42, etag: "e", last_commit_sha: "abc" });
  });

  it("treats the same repo with a different path or adapter as a separate source", async () => {
    await sync([cfg(1), cfg(1, { path: "OTHER.md" }), cfg(1, { adapterId: "other" })]);
    expect(await rowsOf()).toHaveLength(3);
  });

  it("rejects invalid input atomically (nothing is inserted)", async () => {
    const bad: [string, unknown][] = [
      ["not an array", { a: 1 }],
      ["element not an object", ["x"]],
      ["owner", [cfg(1), cfg(2, { owner: "bad owner" })]],
      ["owner too long", [cfg(2, { owner: "a".repeat(101) })]],
      ["owner slash", [cfg(2, { owner: "a/b" })]],
      ["repo", [cfg(2, { repo: "r;drop table x" })]],
      ["missing repo", [{ owner: "a", path: "p", adapterId: "x" }]],
      ["path traversal", [cfg(2, { path: "../etc/passwd" })]],
      ["path dot segment", [cfg(2, { path: "a/./b.md" })]],
      ["absolute path", [cfg(2, { path: "/README.md" })]],
      ["path chars", [cfg(2, { path: "READ ME.md" })]],
      ["path too long", [cfg(2, { path: "a".repeat(201) })]],
      ["empty path", [cfg(2, { path: "" })]],
      ["adapter uppercase", [cfg(2, { adapterId: "Pipe" })]],
      ["adapter too long", [cfg(2, { adapterId: "a".repeat(41) })]],
      ["adapterVersion", [cfg(2, { adapterVersion: "1 2" })]],
      ["license too long", [cfg(2, { license: "x".repeat(101) })]],
      ["attribution too long", [cfg(2, { attribution: "x".repeat(1001) })]],
      ["branch", [cfg(2, { defaultBranch: "a b" })]],
      ["non-string field", [cfg(2, { license: 5 })]],
      ["too many", Array.from({ length: 51 }, (_, i) => cfg(i))],
    ];
    for (const [label, input] of bad) {
      await rejects(sync(input)).then((m) => expect(m, label).toBeTruthy());
    }
    expect(await rowsOf()).toHaveLength(0);
    expect(await sync(Array.from({ length: 50 }, (_, i) => cfg(i)))).toBe(50);
  });

  it("only discovery_ingest may execute it; anon, authenticated and public are denied", async () => {
    const u = await createUser(db, "user@example.test");
    expect(await rejects(as(db, { uid: u }, () => db.query("select public.sync_job_sources('[]'::jsonb)")))).toMatch(/permission denied/i);
    expect(await rejects(sync([cfg(1)], "authenticated"))).toMatch(/permission denied/i);
    expect(await rejects(sync([cfg(1)], "anon"))).toMatch(/permission denied/i);
    expect(await sync([cfg(1)], "discovery_ingest")).toBe(1);
    const acl = await db.query<{ a: string | null }>(
      "select proacl::text a from pg_proc where proname = 'sync_job_sources' and pronamespace = 'public'::regnamespace",
    );
    expect(acl.rows[0].a).not.toMatch(/(^\{|,)=X/);
    expect(acl.rows[0].a).toContain("discovery_ingest=X");
  });

  it("is SECURITY DEFINER with a fixed search_path", async () => {
    const r = await db.query<{ prosecdef: boolean; proconfig: string[] }>(
      "select prosecdef, proconfig from pg_proc where proname = 'sync_job_sources' and pronamespace = 'public'::regnamespace",
    );
    expect(r.rows[0].prosecdef).toBe(true);
    expect(r.rows[0].proconfig?.join(",")).toMatch(/search_path=/);
  });

  it("migration 0010 alone inserts every checked-in source (insert-only, idempotent)", async () => {
    const mig = readFileSync(join(process.cwd(), "supabase/migrations/20261010000010_sync_sources.sql"), "utf8");
    await db.exec("delete from public.job_sources");
    await db.exec(mig);
    await db.exec(mig);
    const keys = (await rowsOf()).map((r) => `${r.repo_owner}/${r.repo_name}/${r.path}/${r.adapter_id}`);
    const added = [
      "aprameyak/2027-tech-jobs/SUMMER.md/aprameyak",
      "aprameyak/2027-tech-jobs/OFFCYCLE.md/aprameyak",
      "jobbie-bot/Summer-2027-Tech-Internships/README.md/jobbie",
      "resumax/tech-internships/README.md/resumax",
      "jobright-ai/2026-Software-Engineer-Internship/README.md/jobright",
    ];
    expect(keys).toEqual(expect.arrayContaining(added));
    // Every row the migration seeds is a configured source and vice versa for the sources it introduces.
    const configured = new Set(SOURCES.map((s) => `${s.owner}/${s.repo}/${s.path}/${s.adapterId}`));
    for (const k of keys) expect(configured.has(k), k).toBe(true);
    expect((await rowsOf()).every((r) => r.enabled)).toBe(true);
  });

  it("syncing every checked-in source after all migrations yields exactly the configured set", async () => {
    const payload = SOURCES.filter((s) => s.enabled).map((s) => ({
      owner: s.owner,
      repo: s.repo,
      path: s.path,
      adapterId: s.adapterId,
      adapterVersion: s.adapterVersion,
      license: s.license,
      attribution: s.attribution,
    }));
    expect(await sync(payload)).toBe(payload.length);
    expect(await rowsOf()).toHaveLength(SOURCES.length);
    expect(await sync(payload)).toBe(0);
  });
});

// A database that predates migration 0010 simply lacks the function.
describe("older database without the function", () => {
  it("reports undefined_function (42883), which the runner ignores", async () => {
    const bare = new PGlite();
    const err = await bare.query("select public.sync_job_sources('[]'::jsonb)").catch((e: { code?: string }) => e);
    expect((err as { code?: string }).code).toBe("42883");
    await bare.close();
  });
});
