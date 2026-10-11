import { describe, expect, it } from "vitest";
import {
  cohortFilter,
  interviewCount,
  offerRate,
  pipelineCounts,
  practiceSummary,
  submittedCount,
  weeklyApplications,
  type AppRow,
  type AttemptRow,
  type Cohort,
  type ProblemRow,
  type TopicRow,
} from "@/lib/domain";

let n = 0;
const app = (o: Partial<AppRow> = {}): AppRow => ({
  id: `a${++n}`,
  status: "applied",
  submitted_precision: "day",
  submitted_year: 2026,
  submitted_month: 10,
  submitted_day: 7,
  submission_date_unknown: false,
  season: "summer",
  season_year: 2027,
  trashed_at: null,
  archived_at: null,
  ...o,
});
const cohort: Cohort = { seasonYear: 2027, season: "summer", includeUnclassified: false, includeArchived: false, allHistory: false };

describe("cohortFilter and submitted count", () => {
  const apps = [
    app(),
    app({ status: "saved" }),
    app({ status: "prepared" }),
    app({ status: "offer" }),
    app({ trashed_at: "2026-10-01T00:00:00Z" }),
    app({ archived_at: "2026-10-01T00:00:00Z" }),
    app({ season: null, season_year: null }),
    app({ season_year: 2026 }),
  ];
  it("excludes saved/prepared, trashed, archived, other seasons and unclassified by default", () => {
    expect(submittedCount(apps, cohort)).toBe(2);
  });
  it("includes archived and unclassified only when selected, and counts unclassified", () => {
    expect(submittedCount(apps, { ...cohort, includeArchived: true })).toBe(3);
    expect(submittedCount(apps, { ...cohort, includeUnclassified: true })).toBe(3);
    expect(cohortFilter(apps, cohort).unclassified).toBe(1);
  });
  it("all history ignores season but never trashed", () => {
    expect(submittedCount(apps, { ...cohort, allHistory: true })).toBe(4);
  });
});

describe("pipelineCounts", () => {
  it("counts current status of nontrashed apps", () => {
    const c = pipelineCounts([app(), app(), app({ status: "rejected" }), app({ trashed_at: "x" })]);
    expect(c.applied).toBe(2);
    expect(c.rejected).toBe(1);
    expect(c.offer).toBe(0);
  });
});

describe("weeklyApplications", () => {
  const tz = "America/Puerto_Rico";
  const now = new Date("2026-10-10T16:00:00Z");
  it("groups day-precision dates by Monday-start week (Sunday belongs to the prior Monday)", () => {
    const r = weeklyApplications(
      [
        app({ submitted_day: 4 }), // Sunday -> week of Sep 28
        app({ submitted_day: 5 }), // Monday
        app({ submitted_day: 11 }), // Sunday -> week of Oct 5
        app({ submitted_day: 12 }), // next Monday, outside window
      ],
      tz,
      3,
      now,
    );
    expect(r.weeks).toEqual([
      { weekStart: "2026-09-21", count: 0 },
      { weekStart: "2026-09-28", count: 1 },
      { weekStart: "2026-10-05", count: 2 },
    ]);
  });
  it("month/year/unknown precision go to unallocated, never a week", () => {
    const r = weeklyApplications(
      [
        app({ submitted_precision: "month", submitted_day: null }),
        app({ submitted_precision: "year", submitted_month: null, submitted_day: null }),
        app({
          submitted_precision: "unknown",
          submitted_year: null,
          submitted_month: null,
          submitted_day: null,
          submission_date_unknown: true,
        }),
        app({ status: "saved", submitted_precision: null }),
      ],
      tz,
      4,
      now,
    );
    expect(r.unallocated).toBe(3);
    expect(r.weeks.reduce((s, w) => s + w.count, 0)).toBe(0);
    expect(r.weeks).toHaveLength(4);
  });
  it("the date-only value is not shifted by timezone", () => {
    const edge = new Date("2026-10-12T03:00:00Z");
    const a = app({ submitted_day: 11 });
    const pr = weeklyApplications([a], "America/Puerto_Rico", 1, edge);
    expect(pr.weeks).toEqual([{ weekStart: "2026-10-05", count: 1 }]);
    const utc = weeklyApplications([a], "UTC", 2, edge);
    expect(utc.weeks.find((w) => w.weekStart === "2026-10-05")!.count).toBe(1);
  });
});

describe("offerRate and interviewCount", () => {
  const a = app();
  const b = app({ status: "accepted" });
  const c = app({ status: "rejected" });
  const d = app({ status: "saved" });
  it("uses recorded offer evidence even after status moved on", () => {
    const r = offerRate(
      [a, b, c, d],
      [{ application_id: c.id }, { application_id: c.id }, { application_id: b.id }, { application_id: d.id }],
    );
    expect(r).toEqual({ numerator: 2, denominator: 3, rate: 2 / 3 });
  });
  it("rate is null with no submitted apps", () => {
    expect(offerRate([d], [])).toEqual({ numerator: 0, denominator: 0, rate: null });
  });
  it("counts distinct apps with interview events or an interview status event", () => {
    expect(
      interviewCount(
        [a, b, c],
        [{ application_id: a.id }, { application_id: a.id }],
        [
          { application_id: b.id, to_status: "interview" },
          { application_id: c.id, to_status: "screening" },
        ],
      ),
    ).toBe(2);
  });
});

describe("practiceSummary", () => {
  const tz = "America/Puerto_Rico"; // UTC-4
  const now = new Date("2026-10-10T16:00:00Z"); // Saturday
  const topics: TopicRow[] = [
    { id: "t-arr", name: "Arrays" },
    { id: "t-dp", name: "DP" },
    { id: "t-gr", name: "Graphs" },
    { id: "t-heap", name: "Heaps" },
  ];
  const problems: ProblemRow[] = [
    { id: "p1", difficulty: "easy", topic_ids: ["t-arr"] },
    { id: "p2", difficulty: "medium", topic_ids: ["t-arr", "t-dp"] },
    { id: "p3", difficulty: "hard", topic_ids: ["t-dp"] },
    { id: "p4", difficulty: "unknown", topic_ids: [] },
  ];
  let k = 0;
  const at = (
    problem_id: string,
    practiced_at: string,
    result: AttemptRow["result"],
    confidence: number | null = 3,
    next: string | null = null,
  ): AttemptRow => ({
    id: `x${++k}`,
    problem_id,
    practiced_at,
    result,
    confidence,
    next_review_date: next,
  });
  const opts = { now, tz, weeklyGoal: 5 };

  it("counts distinct problems; revisits are attempts; hinted/reviewed are not independent", () => {
    const s = practiceSummary(
      [
        at("p1", "2026-10-09T15:00:00Z", "solved_independently"),
        at("p1", "2026-10-10T15:00:00Z", "solved_independently"),
        at("p2", "2026-10-10T15:00:00Z", "solved_with_hints"),
        at("p3", "2026-10-10T15:00:00Z", "reviewed_solution"),
        at("p4", "2026-10-10T15:00:00Z", "unsolved"),
      ],
      problems,
      topics,
      opts,
    );
    expect(s.distinctProblems).toBe(4);
    expect(s.distinctIndependentlySolved).toBe(1);
    expect(s.difficultyMix).toEqual({ easy: 1, medium: 1, hard: 1, unknown: 1 });
    expect(s.thisWeek).toEqual({ weekStart: "2026-10-05", attempts: 5, goal: 5 });
    expect(s.attemptsPerWeek).toEqual([{ weekStart: "2026-10-05", count: 5 }]);
  });

  it("multi-topic attempts count toward each topic; small samples are limited data", () => {
    const s = practiceSummary([at("p2", "2026-10-10T15:00:00Z", "solved_independently", 5)], problems, topics, opts);
    const arr = s.topics.find((t) => t.topic.id === "t-arr")!;
    const dp = s.topics.find((t) => t.topic.id === "t-dp")!;
    expect([arr.attempts, dp.attempts]).toEqual([1, 1]);
    expect(arr.limitedData).toBe(true);
    expect(arr.independentRate).toBe(1);
    expect(arr.avgConfidence).toBe(5);
    expect(s.weakTopics).toEqual([]);
  });

  it("weak topics need >=5 attempts and low rate or confidence; unpracticed listed separately", () => {
    const lowRate = Array.from({ length: 5 }, (_, i) =>
      at("p3", `2026-10-0${i + 1}T15:00:00Z`, i === 0 ? "solved_independently" : "unsolved", 4),
    );
    const lowConf = Array.from({ length: 5 }, (_, i) => at("p1", `2026-10-0${i + 1}T16:00:00Z`, "solved_independently", 2));
    const fine = Array.from({ length: 4 }, (_, i) => at("p4", `2026-10-0${i + 1}T17:00:00Z`, "unsolved", 1));
    const s = practiceSummary([...lowRate, ...lowConf, ...fine], problems, topics, opts);
    expect(s.weakTopics.map((t) => t.topic.id).sort()).toEqual(["t-arr", "t-dp"]);
    expect(s.unpracticedTopics.map((t) => t.id).sort()).toEqual(["t-gr", "t-heap"]);
    expect(s.topics.find((t) => t.topic.id === "t-arr")!.limitedData).toBe(false);
  });

  it("exactly 50% rate with confidence 3 is not weak", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      at("p3", `2026-10-0${i + 1}T15:00:00Z`, i < 3 ? "solved_independently" : "unsolved", 3),
    );
    expect(practiceSummary(rows, problems, topics, opts).weakTopics).toEqual([]);
  });

  it("due reviews use the latest attempt per problem and the local date", () => {
    const s = practiceSummary(
      [
        at("p1", "2026-10-01T15:00:00Z", "unsolved", 3, "2026-10-05"),
        at("p1", "2026-10-08T15:00:00Z", "solved_independently", 4, "2026-10-20"),
        at("p2", "2026-10-02T15:00:00Z", "unsolved", 3, "2026-10-10"),
        at("p3", "2026-10-02T15:00:00Z", "unsolved", 3, "2026-10-11"),
      ],
      problems,
      topics,
      opts,
    );
    expect(s.dueReviews.map((a) => a.problem_id)).toEqual(["p2"]);
  });

  it("streak counts consecutive local days ending today or yesterday", () => {
    const run = (iso: string[]) =>
      practiceSummary(
        iso.map((d) => at("p1", d, "unsolved")),
        problems,
        topics,
        opts,
      ).streak;
    expect(run(["2026-10-10T15:00:00Z", "2026-10-09T15:00:00Z", "2026-10-08T15:00:00Z"])).toBe(3);
    expect(run(["2026-10-09T15:00:00Z", "2026-10-08T15:00:00Z"])).toBe(2);
    expect(run(["2026-10-08T15:00:00Z"])).toBe(0);
    expect(run(["2026-10-10T15:00:00Z", "2026-10-08T15:00:00Z"])).toBe(1);
    expect(run([])).toBe(0);
  });

  it("streak and week boundaries use the profile timezone", () => {
    // 01:00Z Oct 11 is still Saturday Oct 10 in Puerto Rico
    const s = practiceSummary([at("p1", "2026-10-11T01:00:00Z", "unsolved")], problems, topics, opts);
    expect(s.streak).toBe(1);
    expect(s.thisWeek.attempts).toBe(1);
    const utc = practiceSummary([at("p1", "2026-10-11T01:00:00Z", "unsolved")], problems, topics, {
      ...opts,
      tz: "UTC",
      now: new Date("2026-10-11T02:00:00Z"),
    });
    expect(utc.thisWeek.weekStart).toBe("2026-10-05");
  });

  it("period filter limits stats but not streak/due reviews; week counts include zero weeks", () => {
    const rows = [at("p1", "2026-09-14T15:00:00Z", "unsolved"), at("p2", "2026-10-09T15:00:00Z", "solved_independently")];
    const s = practiceSummary(rows, problems, topics, { ...opts, from: "2026-09-28", to: "2026-10-10" });
    expect(s.distinctProblems).toBe(1);
    expect(s.attemptsPerWeek).toEqual([
      { weekStart: "2026-09-28", count: 0 },
      { weekStart: "2026-10-05", count: 1 },
    ]);
    expect(s.streak).toBe(1);
  });
});
