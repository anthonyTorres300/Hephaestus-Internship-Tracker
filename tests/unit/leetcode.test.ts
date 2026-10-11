import { describe, expect, it, vi } from "vitest";
import { LEETCODE_USERNAME, fetchLeetCodeProfile } from "@/lib/leetcode/client";

const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const SAMPLE = {
  data: {
    matchedUser: {
      username: "Neet",
      profile: { ranking: 838065 },
      submitStats: {
        acSubmissionNum: [
          { difficulty: "All", count: 205, submissions: 349 },
          { difficulty: "Easy", count: 103, submissions: 171 },
          { difficulty: "Medium", count: 98, submissions: 162 },
          { difficulty: "Hard", count: 4, submissions: 16 },
        ],
        totalSubmissionNum: [{ difficulty: "All", count: 216, submissions: 970 }],
      },
      languageProblemCount: [
        { languageName: "Python", problemsSolved: 100 },
        { languageName: "C++", problemsSolved: 244 },
        { languageName: "Zero", problemsSolved: 0 },
      ],
      badges: [{ displayName: "50 Days Badge 2022" }],
      tagProblemCounts: {
        fundamental: [
          { tagName: "Array", problemsSolved: 80 },
          { tagName: "Queue", problemsSolved: 0 },
        ],
        intermediate: [{ tagName: "Tree", problemsSolved: 37 }],
        advanced: [{ tagName: "Segment Tree", problemsSolved: 1 }],
      },
      userCalendar: {
        streak: 12,
        totalActiveDays: 120,
        submissionCalendar: '{"1760000000": 3, "1760086400": 5, "bad": 1, "1760172800": 0}',
      },
    },
    allQuestionsCount: [
      { difficulty: "All", count: 4073 },
      { difficulty: "Easy", count: 969 },
      { difficulty: "Medium", count: 2124 },
      { difficulty: "Hard", count: 980 },
    ],
    userContestRanking: { rating: 1850.4, attendedContestsCount: 2, globalRanking: 12345, topPercentage: 8.2 },
    userContestRankingHistory: [
      { attended: false, rating: 1500, contest: { title: "Skipped", startTime: 1700000000 } },
      { attended: true, rating: 1700.2, contest: { title: "Weekly 1", startTime: 1710000000 } },
      { attended: true, rating: 1850.4, contest: { title: "Weekly 2", startTime: 1720000000 } },
    ],
    recentAcSubmissionList: [
      { title: "Two Sum", titleSlug: "two-sum", timestamp: "1760000000" },
      { title: "Evil", titleSlug: "../../etc/passwd", timestamp: "1760000001" },
    ],
  },
};

describe("LeetCode public profile client", () => {
  it("validates usernames before any request", async () => {
    const f = vi.fn();
    for (const bad of ["", "a b", "x".repeat(31), "../evil", "a;b", "名前"]) {
      expect(LEETCODE_USERNAME.test(bad)).toBe(false);
      expect(await fetchLeetCodeProfile(bad, f as unknown as typeof fetch)).toEqual({ ok: false, reason: "invalid_username" });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("parses totals, topics (non-zero, sorted), streak and recent solves, dropping unsafe slugs", async () => {
    const r = await fetchLeetCodeProfile("neet", ok(SAMPLE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.solved).toEqual({ all: 205, easy: 103, medium: 98, hard: 4 });
    expect(r.profile.tags.map((t) => t.name)).toEqual(["Array", "Tree", "Segment Tree"]);
    expect(r.profile.streak).toBe(12);
    expect(r.profile.available).toEqual({ all: 4073, easy: 969, medium: 2124, hard: 980 });
    expect(r.profile.submissions).toEqual({ accepted: 349, total: 970 });
    expect(r.profile.languages).toEqual([
      { name: "C++", count: 244 },
      { name: "Python", count: 100 },
    ]);
    expect(r.profile.badges).toEqual(["50 Days Badge 2022"]);
    expect(r.profile.calendar).toHaveLength(2);
    expect(r.profile.calendar[0]).toMatchObject({ count: 3 });
    expect(r.profile.contest).toMatchObject({ rating: 1850.4, attended: 2, globalRanking: 12345 });
    expect(r.profile.contest!.history.map((h) => h.title)).toEqual(["Weekly 1", "Weekly 2"]);
    expect(r.profile.recent).toHaveLength(1);
    expect(r.profile.recent[0]).toMatchObject({ title: "Two Sum", slug: "two-sum" });
  });

  it("only ever calls leetcode.com and sends just the username", async () => {
    const f = ok(SAMPLE);
    await fetchLeetCodeProfile("neet", f);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://leetcode.com/graphql");
    expect(JSON.parse(String(init.body)).variables).toEqual({ username: "neet" });
    expect(JSON.stringify(init.headers)).not.toMatch(/cookie|authorization|csrf/i);
  });

  it("reports unknown users, outages and malformed responses without throwing", async () => {
    expect(await fetchLeetCodeProfile("ghost", ok({ data: { matchedUser: null } }))).toEqual({ ok: false, reason: "not_found" });
    expect(await fetchLeetCodeProfile("neet", ok({}, 503))).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchLeetCodeProfile("neet", ok({ unexpected: true }))).toEqual({ ok: false, reason: "unavailable" });
    const boom = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await fetchLeetCodeProfile("neet", boom)).toEqual({ ok: false, reason: "unavailable" });
    const html = vi.fn(async () => new Response("<html>blocked</html>")) as unknown as typeof fetch;
    expect(await fetchLeetCodeProfile("neet", html)).toEqual({ ok: false, reason: "unavailable" });
  });
});
