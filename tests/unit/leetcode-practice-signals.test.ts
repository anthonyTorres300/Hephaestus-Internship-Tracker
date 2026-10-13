import { describe, expect, it } from "vitest";
import { practiceSignals } from "@/lib/leetcode/practice-signals";
import type { PracticeAttempt, PracticeProblem } from "@/lib/data/types";
import { recommend } from "@/lib/leetcode/recommend";

const problem: PracticeProblem = {
  id: "p1",
  platform: "leetcode",
  platform_id: null,
  slug: null,
  url: null,
  title: "Two Sum",
  difficulty: "unknown",
};
const attempt: PracticeAttempt = {
  id: "a1",
  problem_id: "p1",
  practiced_at: "2026-10-12T12:00:00Z",
  duration_minutes: null,
  duration_unknown: true,
  language: null,
  result: "solved_with_hints",
  confidence: 2,
  notes: null,
  next_review_date: "2026-10-13",
};

describe("practice recommendation signals", () => {
  it("recognizes catalog titles and fills unknown difficulty without changing logged data", () => {
    const signals = practiceSignals([problem], [attempt], "2026-10-13");
    expect([...signals.solved]).toEqual(["two-sum"]);
    expect(signals.solvedByDifficulty).toEqual({ easy: 1, medium: 0, hard: 0 });
    expect(signals.practice["two-sum"]).toMatchObject({ confidence: 2, reviewDue: true });
    expect(problem.difficulty).toBe("unknown");
  });

  it("uses the latest attempt even if history arrives out of order", () => {
    const newer = {
      ...attempt,
      id: "a2",
      practiced_at: "2026-10-13T12:00:00Z",
      result: "solved_independently" as const,
      confidence: 5,
      next_review_date: "2026-10-20",
    };
    const signals = practiceSignals([problem], [newer, attempt], "2026-10-13");
    expect(signals.practice["two-sum"]).toEqual({ result: "solved_independently", confidence: 5, reviewDue: false });
    expect(
      recommend({ ...signals, weakTopics: [], unpracticedTopics: [], topicSolves: null }).some((r) => r.problem.slug === "two-sum"),
    ).toBe(false);
  });

  it("deduplicates solves recorded by URL and title and uses the latest confidence", () => {
    const duplicate = { ...problem, id: "p2", title: "Custom title", url: "https://leetcode.com/problems/two-sum/" };
    const newer = { ...attempt, id: "a2", problem_id: "p2", practiced_at: "2026-10-13T12:00:00Z", confidence: 4 };
    const signals = practiceSignals([problem, duplicate], [attempt, newer], "2026-10-13");
    expect(signals.solvedByDifficulty.easy).toBe(1);
    expect(signals.practice["two-sum"].confidence).toBe(4);
  });

  it("retains ever-solved status while considering the latest low confidence", () => {
    const newer = {
      ...attempt,
      id: "a2",
      practiced_at: "2026-10-13T12:00:00Z",
      result: "unsolved" as const,
      confidence: 1,
      next_review_date: null,
    };
    const signals = practiceSignals([problem], [attempt, newer], "2026-10-13");
    expect(signals.solved.has("two-sum")).toBe(true);
    expect(signals.attempted.has("two-sum")).toBe(false);
    expect(recommend({ ...signals, weakTopics: [], unpracticedTopics: [], topicSolves: null })[0].kind).toBe("build_confidence");
  });
});
