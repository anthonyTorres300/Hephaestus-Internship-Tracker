import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, type Db } from "./harness";
import { assessEligibility, type JobFacts, type JobRequirements, type UserProfile } from "@/lib/domain/eligibility";
import { HOT_COMPANY_MATCHERS } from "@/lib/jobs/hot-companies";

let db: Db;
let alice: string;
let bob: string;
let firstJob: string;
beforeAll(async () => {
  db = await createDb();
  alice = await createUser(db, "feed-alice@example.test");
  bob = await createUser(db, "feed-bob@example.test");
  const rows = await db.query<{
    id: string;
  }>(`insert into public.jobs(company,title,role_category,season,season_year,locations,identity_key,candidate_key,search_text,first_seen_at)
    select 'Amazon Web Services','SWE Intern ' || g,'software','summer',2027,'["Remote"]','feed-' || g,'feed-c-' || g,'aws intern',now() - g * interval '1 minute' from generate_series(1,60) g returning id`);
  firstJob = rows.rows[0].id;
});
afterAll(async () => {
  await db.close();
});
interface Result {
  rows: { id: string; application_id: string | null }[];
  total: number;
  page: number;
  companies: { name: string; n: number }[];
  counts: { all: number; new: number; saved: number };
}
async function feed(uid: string, filters: Record<string, unknown> = {}, page = 1) {
  return as(
    db,
    { uid },
    async () =>
      (
        await db.query<{ r: Result }>("select public.jobs_feed_page($1::jsonb,$2,25,$3::jsonb) r", [
          JSON.stringify(filters),
          page,
          JSON.stringify(HOT_COMPANY_MATCHERS),
        ])
      ).rows[0].r,
  );
}

describe("database feed pagination", () => {
  it("returns only one page with stable ordering and accurate counts", async () => {
    const first = await feed(alice);
    const second = await feed(alice, {}, 2);
    expect(first.total).toBe(60);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(25);
    expect(second.rows.some((r) => first.rows.some((f) => f.id === r.id))).toBe(false);
    expect(first.companies).toContainEqual({ name: "Amazon", n: 60 });
    expect(await feed(alice, {}, 99)).toMatchObject({ page: 3, total: 60 });
    expect((await feed(alice, {}, 99)).rows).toHaveLength(10);
  });
  it("applies search and role filters before paging", async () => {
    expect((await feed(alice, { q: "Intern 60" })).rows).toHaveLength(1);
    expect((await feed(alice, { categories: ["data"] })).total).toBe(0);
    expect((await feed(alice, { company: "Amazon" })).total).toBe(60);
    expect((await feed(alice, { company: "Google" })).total).toBe(0);
  });
  it("keeps saved, hidden and application state isolated between users", async () => {
    await as(db, { uid: alice }, () =>
      db.query("insert into public.user_jobs(user_id,job_id,saved,hidden) values ($1,$2,true,true)", [alice, firstJob]),
    );
    expect((await feed(alice)).total).toBe(59);
    expect((await feed(bob)).total).toBe(60);
    expect((await feed(alice, { showHidden: true, tab: "saved" })).total).toBe(1);
    expect((await feed(bob, { showHidden: true, tab: "saved" })).total).toBe(0);
    await as(db, { uid: alice }, () =>
      db.query("select public.create_application($1::jsonb)", [
        JSON.stringify({ company_name: "AWS", role_title: "SWE Intern", job_id: firstJob, status: "prepared" }),
      ]),
    );
    expect((await feed(alice, { showHidden: true })).total).toBe(59);
    const included = await feed(alice, { showHidden: true, showApplied: true });
    expect(included.rows.find((r) => r.id === firstJob)?.application_id).toBeTruthy();
    expect((await feed(bob)).total).toBe(60);
  });
  it("denies anonymous calls", async () => {
    await expect(as(db, { role: "anon" }, () => db.query("select public.jobs_feed_page()"))).rejects.toThrow(/permission denied/);
  });
});

const profile: UserProfile = {
  graduation_year: 2029,
  graduation_month: 5,
  degree: "bachelors",
  work_authorization_country: "US",
  work_authorized: true,
  requires_sponsorship: false,
  citizenship_countries: ["US"],
  citizenship_known: true,
  us_person: true,
  clearance_eligible: true,
  preferred_countries: ["US"],
  preferred_locations: [],
  preferred_categories: [],
  willing_to_relocate: true,
  remote_preference: "any",
  confirmed_skills: [],
  target_season: "summer",
  target_year: 2027,
};
describe("eligibility parity", () => {
  const cases: { req: JobRequirements; patch?: Partial<UserProfile>; country?: string | null }[] = [
    { req: {} },
    { req: { graduation_to: { year: 2028, month: 12 } } },
    { req: { graduate_only: true } },
    { req: { degree_levels: ["bachelors"], graduation_from: { year: 2029, month: 1 }, graduation_to: { year: 2029, month: 12 } } },
    { req: { sponsorship_offered: false }, patch: { requires_sponsorship: true } },
    { req: { sponsorship_offered: false }, patch: { work_authorized: false } },
    { req: { requires_citizenship: ["CA"] } },
    { req: { requires_citizenship: ["US"] }, patch: { citizenship_known: false } },
    { req: { requires_us_person: true }, patch: { us_person: false } },
    { req: { requires_clearance: true }, patch: { clearance_eligible: null } },
    { req: { remote_restricted_to: ["CA"] } },
    { req: { remote_restricted_to: ["US-CA"] } },
    { req: { remote_restricted_to: ["US-CA", "US"] } },
    { req: { requires_visa_program: "J1" } },
    { req: {}, country: "CA" },
    { req: {}, country: null },
    { req: { degree_levels: ["bachelors"] }, patch: { degree: "other" } },
  ];
  it.each(cases)("matches domain assessment for %j", async ({ req, patch, country }) => {
    const p = { ...profile, ...patch };
    const c = country === undefined ? "US" : country;
    const job: JobFacts = {
      role_category: "software",
      season: "summer",
      season_year: 2027,
      locations: [],
      country: c,
      work_mode: "remote",
      requirements: req,
    };
    const result = await db.query<{ result: string }>("select public.feed_eligibility($1::jsonb,$2::jsonb,$3) result", [
      JSON.stringify(p),
      JSON.stringify(req),
      c,
    ]);
    expect(result.rows[0].result).toBe(assessEligibility(p, job).result);
  });
});
