import { describe, expect, it } from "vitest";
import {
  MISSING_EVIDENCE,
  assessEligibility,
  isDefaultFeedVisible,
  missingEvidence,
  scoreJob,
  SCORING_VERSION,
  type JobFacts,
  type UserProfile,
} from "@/lib/domain";

const blank: UserProfile = {
  graduation_year: null,
  graduation_month: null,
  degree: null,
  work_authorization_country: null,
  work_authorized: null,
  requires_sponsorship: null,
  citizenship_countries: [],
  citizenship_known: false,
  us_person: null,
  clearance_eligible: null,
  preferred_countries: [],
  preferred_locations: [],
  preferred_categories: [],
  willing_to_relocate: null,
  remote_preference: null,
  confirmed_skills: [],
  target_season: null,
  target_year: null,
};
const anthony: UserProfile = {
  ...blank,
  graduation_year: 2029,
  graduation_month: 5,
  degree: "bachelors",
  work_authorization_country: "US",
  work_authorized: true,
  requires_sponsorship: false,
  preferred_countries: ["US"],
  preferred_locations: ["Puerto Rico"],
  preferred_categories: ["software"],
  willing_to_relocate: true,
  confirmed_skills: ["Python", "TypeScript"],
  target_season: "summer",
  target_year: 2027,
};
const international: UserProfile = {
  ...blank,
  graduation_year: 2027,
  graduation_month: 12,
  degree: "masters",
  work_authorization_country: "CA",
  work_authorized: true,
  requires_sponsorship: true,
  preferred_countries: ["CA"],
  preferred_locations: ["Toronto"],
  preferred_categories: ["data"],
  willing_to_relocate: false,
  confirmed_skills: ["sql"],
};

const job = (over: Partial<JobFacts> = {}): JobFacts => ({
  role_category: "software",
  season: "summer",
  season_year: 2027,
  locations: ["Austin, TX"],
  country: "US",
  work_mode: "onsite",
  requirements: null,
  first_seen_at: "2026-10-08T00:00:00Z",
  ...over,
});
const rule = (a: ReturnType<typeof assessEligibility>, name: string) => a.rules.find((r) => r.rule === name)!;
const now = new Date("2026-10-10T12:00:00Z");

describe("eligibility: graduation interval", () => {
  const win = (to: { year: number; month: number }, from?: { year: number; month: number }) =>
    job({ requirements: { graduation_from: from, graduation_to: to, degree_levels: ["bachelors"] } });
  it("explicit contradiction is ineligible and hidden from default feed", () => {
    const a = assessEligibility(anthony, win({ year: 2028, month: 12 }));
    expect(rule(a, "graduation").outcome).toBe("fail");
    expect(a.result).toBe("ineligible");
    expect(isDefaultFeedVisible(a.result)).toBe(false);
  });
  it("bounds are inclusive months", () => {
    expect(rule(assessEligibility(anthony, win({ year: 2029, month: 5 })), "graduation").outcome).toBe("pass");
    expect(rule(assessEligibility(anthony, win({ year: 2029, month: 4 })), "graduation").outcome).toBe("fail");
    expect(rule(assessEligibility(anthony, win({ year: 2029, month: 12 }, { year: 2029, month: 5 })), "graduation").outcome).toBe("pass");
    expect(rule(assessEligibility(anthony, win({ year: 2029, month: 12 }, { year: 2029, month: 6 })), "graduation").outcome).toBe("fail");
  });
  it("unknown user fact or unknown requirement is unknown, not fail", () => {
    expect(rule(assessEligibility(blank, win({ year: 2028, month: 12 })), "graduation").outcome).toBe("unknown");
    expect(rule(assessEligibility(anthony, job()), "graduation").outcome).toBe("unknown");
  });
});

describe("eligibility: degree", () => {
  it("graduate-only vs bachelors is ineligible", () => {
    const a = assessEligibility(anthony, job({ requirements: { graduate_only: true } }));
    expect(rule(a, "degree").outcome).toBe("fail");
    expect(a.result).toBe("ineligible");
  });
  it("masters passes graduate-only; degree level lists", () => {
    expect(rule(assessEligibility(international, job({ requirements: { graduate_only: true } })), "degree").outcome).toBe("pass");
    expect(rule(assessEligibility(anthony, job({ requirements: { degree_levels: ["masters", "phd"] } })), "degree").outcome).toBe("fail");
    expect(rule(assessEligibility(blank, job({ requirements: { graduate_only: true } })), "degree").outcome).toBe("unknown");
  });
});

describe("eligibility: authorization and sponsorship", () => {
  it("US authorization is country-specific", () => {
    const a = assessEligibility(international, job());
    expect(rule(a, "work_authorization").outcome).toBe("unknown");
    expect(rule(assessEligibility(anthony, job()), "work_authorization").outcome).toBe("pass");
    expect(rule(assessEligibility(blank, job()), "work_authorization").outcome).toBe("unknown");
  });
  it("employer offering sponsorship never excludes someone who needs none", () => {
    const a = assessEligibility(anthony, job({ requirements: { sponsorship_offered: true } }));
    expect(rule(a, "sponsorship").outcome).toBe("pass");
    expect(
      assessEligibility(anthony, job({ requirements: { sponsorship_offered: false } })).rules.find((r) => r.rule === "sponsorship")!
        .outcome,
    ).toBe("pass");
  });
  it("needing sponsorship against an explicit no is a fail; unknown is review", () => {
    expect(rule(assessEligibility(international, job({ requirements: { sponsorship_offered: false } })), "sponsorship").outcome).toBe(
      "fail",
    );
    expect(rule(assessEligibility(international, job()), "sponsorship").outcome).toBe("unknown");
    expect(rule(assessEligibility(international, job({ requirements: { sponsorship_offered: true } })), "sponsorship").outcome).toBe(
      "pass",
    );
  });
  it("a specific visa program needs review", () => {
    const a = assessEligibility(anthony, job({ requirements: { requires_visa_program: "CPT" } }));
    expect(rule(a, "visa_program").outcome).toBe("unknown");
  });
});

describe("eligibility: citizenship, US person, clearance", () => {
  it("stay unknown until the profile fact is known", () => {
    const r = { requires_citizenship: ["US"], requires_us_person: true, requires_clearance: true };
    const a = assessEligibility(anthony, job({ requirements: r }));
    expect(rule(a, "citizenship").outcome).toBe("unknown");
    expect(rule(a, "us_person").outcome).toBe("unknown");
    expect(rule(a, "clearance").outcome).toBe("unknown");
    expect(a.result).toBe("needs_review");
  });
  it("work authorization does not imply citizenship", () => {
    const a = assessEligibility(anthony, job({ requirements: { requires_citizenship: ["US"] } }));
    expect(rule(a, "citizenship").outcome).toBe("unknown");
  });
  it("fail only on an explicit mismatch", () => {
    const r = { requires_citizenship: ["US"], requires_us_person: true, requires_clearance: true };
    const known = { ...anthony, citizenship_known: true, citizenship_countries: ["CA"], us_person: false, clearance_eligible: false };
    const a = assessEligibility(known, job({ requirements: r }));
    expect([rule(a, "citizenship").outcome, rule(a, "us_person").outcome, rule(a, "clearance").outcome]).toEqual(["fail", "fail", "fail"]);
    const ok = { ...known, citizenship_countries: ["us"], us_person: true, clearance_eligible: true };
    const b = assessEligibility(ok, job({ requirements: r }));
    expect([rule(b, "citizenship").outcome, rule(b, "us_person").outcome, rule(b, "clearance").outcome]).toEqual(["pass", "pass", "pass"]);
  });
});

describe("eligibility: remote jurisdiction", () => {
  const remote = (to: string[]) => job({ work_mode: "remote", requirements: { remote_restricted_to: to } });
  it("restriction excluding the user fails; including passes; state-level needs review; unknown location needs review", () => {
    expect(rule(assessEligibility(anthony, remote(["CA"])), "remote_jurisdiction").outcome).toBe("fail");
    expect(rule(assessEligibility(anthony, remote(["US"])), "remote_jurisdiction").outcome).toBe("pass");
    expect(rule(assessEligibility(anthony, remote(["US-CA", "US-NY"])), "remote_jurisdiction").outcome).toBe("unknown");
    expect(rule(assessEligibility(blank, remote(["US"])), "remote_jurisdiction").outcome).toBe("unknown");
  });
  it("plain remote with no restriction does not fail", () => {
    expect(rule(assessEligibility(anthony, job({ work_mode: "remote" })), "remote_jurisdiction").outcome).not.toBe("fail");
  });
});

describe("eligibility: overall result", () => {
  const full = job({
    requirements: { graduation_from: { year: 2029, month: 1 }, graduation_to: { year: 2029, month: 12 }, degree_levels: ["bachelors"] },
  });
  it("eligible only when every rule passes", () => {
    expect(assessEligibility(anthony, full).result).toBe("eligible");
  });
  it("absent requirements are needs_review, never eligible", () => {
    const a = assessEligibility(anthony, job());
    expect(a.result).toBe("needs_review");
    expect(isDefaultFeedVisible(a.result)).toBe(true);
    expect(missingEvidence(a)).toEqual([MISSING_EVIDENCE.graduation, MISSING_EVIDENCE.degree]);
  });
  it("a blank profile is needs_review", () => {
    expect(assessEligibility(blank, full).result).toBe("needs_review");
  });
  it("attaches evidence to determined rules", () => {
    const evidence = { url: "https://x.test/job", text: "Class of 2029", date: "2026-09-01" };
    const a = assessEligibility(anthony, job({ requirements: { ...full.requirements, evidence } }));
    expect(rule(a, "graduation").evidence).toEqual(evidence);
  });
  it("AC: two profiles get independent results for the same job", () => {
    const j = job({
      requirements: {
        graduation_from: { year: 2029, month: 1 },
        graduation_to: { year: 2029, month: 12 },
        degree_levels: ["bachelors"],
        sponsorship_offered: false,
      },
    });
    expect(assessEligibility(anthony, j).result).toBe("eligible");
    expect(assessEligibility(international, j).result).toBe("ineligible");
  });
});

describe("scoreJob v1", () => {
  const strong = job({
    role_category: "software",
    locations: ["San Juan, Puerto Rico"],
    requirements: {
      graduation_from: { year: 2029, month: 1 },
      graduation_to: { year: 2029, month: 12 },
      degree_levels: ["bachelors"],
      skills: ["python", "typescript"],
    },
    source_posted_at: "2026-10-05T00:00:00Z",
  });
  const comp = (s: ReturnType<typeof scoreJob>, n: string) => s.components.find((c) => c.name === n)!;

  it("full marks and High priority for a fully matching eligible job", () => {
    const s = scoreJob(anthony, strong, assessEligibility(anthony, strong), now);
    expect(s.components.map((c) => c.points)).toEqual([30, 25, 20, 15, 10]);
    expect(s.total).toBe(100);
    expect(s.priority).toBe("high");
    expect(s.version).toBe(SCORING_VERSION);
    expect(s.recencyBasis).toBe("source_posted");
  });
  it("role interest: adjacent 15, unrelated 0, unknown 0", () => {
    const score = (p: UserProfile, j: JobFacts) => comp(scoreJob(p, j, assessEligibility(p, j), now), "role_interest");
    expect(score(anthony, job({ role_category: "backend" })).points).toBe(15);
    expect(score(anthony, job({ role_category: "non_technical" })).points).toBe(0);
    expect(score(anthony, job({ role_category: null })).explanation).toContain("insufficient data");
  });
  it("skills fraction; unknown requirements earn 0 with an insufficient-data note", () => {
    const j = job({ requirements: { skills: ["python", "rust", "go", "sql"] } });
    expect(comp(scoreJob(anthony, j, assessEligibility(anthony, j), now), "skills").points).toBe(6);
    const none = scoreJob(anthony, job(), assessEligibility(anthony, job()), now);
    expect(comp(none, "skills").points).toBe(0);
    expect(none.missingEvidence.some((m) => m.includes("skill"))).toBe(true);
  });
  it("graduation/degree 20/10/0", () => {
    const grad = { graduation_from: { year: 2029, month: 1 }, graduation_to: { year: 2029, month: 12 } };
    const g = (j: JobFacts) => comp(scoreJob(anthony, j, assessEligibility(anthony, j), now), "graduation_degree").points;
    expect(g(job({ requirements: { ...grad, degree_levels: ["bachelors"] } }))).toBe(20);
    expect(g(job({ requirements: grad }))).toBe(10);
    expect(g(job())).toBe(0);
  });
  it("location 15 / 8 / 0", () => {
    const loc = (p: UserProfile, j: JobFacts) => comp(scoreJob(p, j, assessEligibility(p, j), now), "location").points;
    expect(loc(anthony, job({ locations: ["San Juan, Puerto Rico"], country: "US" }))).toBe(15);
    expect(loc({ ...anthony, preferred_countries: [], preferred_locations: ["Boston"] }, job())).toBe(8);
    expect(loc({ ...anthony, preferred_countries: [], preferred_locations: ["Boston"], willing_to_relocate: false }, job())).toBe(0);
    expect(loc(anthony, job({ country: "DE", locations: ["Berlin"] }))).toBe(0);
  });
  it("recency: 10 / 5 / 0 with labelled basis, falls back to first seen", () => {
    const rec = (j: JobFacts) => {
      const s = scoreJob(anthony, j, assessEligibility(anthony, j), now);
      return [comp(s, "recency").points, s.recencyBasis] as const;
    };
    expect(rec(job({ first_seen_at: "2026-10-04T12:00:00Z" }))).toEqual([10, "first_seen"]);
    expect(rec(job({ first_seen_at: "2026-09-20T00:00:00Z" }))).toEqual([5, "first_seen"]);
    expect(rec(job({ first_seen_at: "2026-06-01T00:00:00Z" }))).toEqual([0, "first_seen"]);
    expect(rec(job({ first_seen_at: "2026-10-09T00:00:00Z", source_posted_at: "2026-06-01T00:00:00Z" }))).toEqual([0, "source_posted"]);
    expect(comp(scoreJob(anthony, job(), assessEligibility(anthony, job()), now), "recency").explanation).toContain("first seen");
  });
  it("explicit ineligibility is Low regardless of score", () => {
    const j = { ...strong, requirements: { ...strong.requirements, graduation_to: { year: 2028, month: 12 } } };
    const s = scoreJob(anthony, j, assessEligibility(anthony, j), now);
    expect(s.total).toBeGreaterThanOrEqual(75);
    expect(s.priority).toBe("low");
  });
  it("high score with unresolved critical rule is Medium, not High", () => {
    const j = { ...strong, requirements: { ...strong.requirements, requires_clearance: true } };
    const s = scoreJob(anthony, j, assessEligibility(anthony, j), now);
    expect(s.total).toBeGreaterThanOrEqual(75);
    expect(s.priority).toBe("medium");
  });
  it("strong interest with critical unknowns is Medium; otherwise Low", () => {
    const j = job({ first_seen_at: "2025-01-01T00:00:00Z", locations: ["Nowhere"], country: null });
    const s = scoreJob(anthony, j, assessEligibility(anthony, j), now);
    expect(s.total).toBeLessThan(50);
    expect(s.priority).toBe("medium");
    const other = job({ role_category: "non_technical", first_seen_at: "2025-01-01T00:00:00Z" });
    expect(scoreJob(anthony, other, assessEligibility(anthony, other), now).priority).toBe("low");
  });
  it("AC: two profiles with different facts score independently", () => {
    const j = job({
      role_category: "data",
      country: "CA",
      locations: ["Toronto"],
      requirements: { sponsorship_offered: true, skills: ["sql"], graduation_to: { year: 2028, month: 12 }, degree_levels: ["masters"] },
    });
    const a = scoreJob(anthony, j, assessEligibility(anthony, j), now);
    const i = scoreJob(international, j, assessEligibility(international, j), now);
    expect(a.priority).toBe("low");
    expect(i.components.map((c) => c.points)).toEqual([30, 25, 20, 15, 10]);
    expect(i.priority).toBe("high");
  });
});
