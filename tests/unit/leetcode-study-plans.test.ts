import { describe, expect, it } from "vitest";
import { ROADMAP_TOPICS, STUDY_PROBLEMS, studyProblems, studyProgress } from "@/lib/leetcode/study-plans";
import { practiceSignals } from "@/lib/leetcode/practice-signals";
import type { PracticeAttempt, PracticeProblem } from "@/lib/data/types";

describe("study plan metadata", () => {
  it("contains 75 unique Blind 75 problems inside the full NeetCode 150", () => {
    const blind = studyProblems("blind75");
    const neet = studyProblems("neetcode150");
    expect(blind).toHaveLength(75);
    expect(neet).toHaveLength(150);
    expect(new Set(neet.map((problem) => problem.slug)).size).toBe(150);
    expect(blind.every((problem) => neet.some((candidate) => candidate.slug === problem.slug))).toBe(true);
    expect(blind.filter((problem) => problem.difficulty === "easy")).toHaveLength(19);
    expect(blind.filter((problem) => problem.difficulty === "medium")).toHaveLength(49);
    expect(blind.filter((problem) => problem.difficulty === "hard")).toHaveLength(7);
  });

  it("covers all 18 roadmap topics in both plans and offers source-provided alternatives for premium problems", () => {
    for (const plan of ["blind75", "neetcode150"] as const) {
      const problems = studyProblems(plan);
      for (const topic of ROADMAP_TOPICS) expect(problems.some((problem) => problem.group === topic.id)).toBe(true);
      for (const problem of problems) {
        expect(problem.slug).toMatch(/^[a-z0-9-]+$/);
        expect(problem.video).toMatch(/^[a-zA-Z0-9_-]{11}$/);
        if (problem.premium) expect(problem.alternateUrl).toMatch(/^https:\/\/www\.lintcode\.com\/problem\/\d+\/$/);
      }
    }
  });

  it("counts only known solves once, independently of the selected plan", () => {
    const solved = new Set(["two-sum", "valid-sudoku", "outside-plan"]);
    expect(studyProgress(studyProblems("blind75"), solved)).toEqual({ done: 1, total: 75, percent: 1 });
    expect(studyProgress(studyProblems("neetcode150"), solved)).toEqual({ done: 2, total: 150, percent: 1 });
    expect(studyProgress([], solved)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(studyProgress(STUDY_PROBLEMS, new Set(STUDY_PROBLEMS.map((problem) => problem.slug)))).toEqual({
      done: 150,
      total: 150,
      percent: 100,
    });
  });

  it("connects valid topics without cycles or overlapping graph nodes", () => {
    const topics = new Map<string, (typeof ROADMAP_TOPICS)[number]>(ROADMAP_TOPICS.map((topic) => [topic.id, topic]));
    expect(topics.size).toBe(18);
    for (const topic of ROADMAP_TOPICS) {
      for (const parent of topic.parents) {
        expect(topics.has(parent)).toBe(true);
        expect(topics.get(parent)!.y).toBeLessThan(topic.y);
      }
      for (const other of ROADMAP_TOPICS) {
        if (other.id === topic.id) continue;
        expect(Math.abs(other.x - topic.x) >= 180 || Math.abs(other.y - topic.y) >= 76).toBe(true);
      }
    }
  });
});

describe("study plan progress from the manual log", () => {
  it("recognizes plan problems beyond the recommendation catalog by title or URL", () => {
    const problem: PracticeProblem = {
      id: "p1",
      platform: "leetcode",
      platform_id: null,
      slug: null,
      title: "Encode and Decode Strings",
      difficulty: "unknown",
      url: null,
    };
    const attempt: PracticeAttempt = {
      id: "a1",
      problem_id: "p1",
      practiced_at: "2026-10-13T12:00:00Z",
      duration_minutes: null,
      duration_unknown: true,
      language: null,
      result: "solved_with_hints",
      confidence: 3,
      notes: null,
      next_review_date: null,
    };
    const signals = practiceSignals([problem], [attempt], "2026-10-13");
    expect(signals.solved.has("encode-and-decode-strings")).toBe(true);
    expect(studyProgress(studyProblems("blind75"), signals.solved).done).toBe(1);
    expect(signals.solvedByDifficulty.medium).toBe(1);
    const byUrl = practiceSignals(
      [{ ...problem, title: "Custom title", url: "https://leetcode.com/problems/meeting-rooms-ii/" }],
      [attempt],
      "2026-10-13",
    );
    expect(byUrl.solved.has("meeting-rooms-ii")).toBe(true);
  });
});
