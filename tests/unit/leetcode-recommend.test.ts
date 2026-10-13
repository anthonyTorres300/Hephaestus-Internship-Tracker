import { describe, expect, it } from "vitest";
import { CATALOG, catalogBySlug } from "@/lib/leetcode/catalog";
import { difficultyWeights, recommend, topicSolvesFromTags } from "@/lib/leetcode/recommend";

const base = {
  solved: new Set<string>(),
  attempted: new Set<string>(),
  weakTopics: [],
  unpracticedTopics: [],
  topicSolves: null,
  solvedByDifficulty: { easy: 0, medium: 0, hard: 0 },
} as const;

describe("catalog", () => {
  it("has unique slugs, all three difficulties, and only the 15 known topics", () => {
    expect(new Set(CATALOG.map((p) => p.slug)).size).toBe(CATALOG.length);
    expect(CATALOG.length).toBeGreaterThan(100);
    for (const d of ["easy", "medium", "hard"]) expect(CATALOG.some((p) => p.difficulty === d)).toBe(true);
    expect(new Set(CATALOG.map((p) => p.topic)).size).toBe(15);
    expect(catalogBySlug.get("two-sum")).toMatchObject({ title: "Two Sum", difficulty: "easy" });
  });
});

describe("difficulty fit", () => {
  it("moves from easy to medium to hard as the solved counts grow", () => {
    expect(difficultyWeights({ easy: 5, medium: 0, hard: 0 }).easy).toBe(1);
    expect(difficultyWeights({ easy: 50, medium: 20, hard: 0 }).medium).toBe(1);
    expect(difficultyWeights({ easy: 80, medium: 100, hard: 5 }).hard).toBeGreaterThan(0.5);
    expect(difficultyWeights({ easy: 100, medium: 300, hard: 50 }).easy).toBe(0);
  });
});

describe("recommend", () => {
  it("never recommends solved problems and respects the limit", () => {
    const solved = new Set(CATALOG.filter((p) => p.difficulty === "easy").map((p) => p.slug));
    const out = recommend({ ...base, solved, limit: 5 });
    expect(out).toHaveLength(5);
    expect(out.every((r) => !solved.has(r.problem.slug))).toBe(true);
  });

  it("puts attempted-but-unsolved problems first with a retry reason", () => {
    const out = recommend({ ...base, attempted: new Set(["coin-change"]) });
    expect(out[0].problem.slug).toBe("coin-change");
    expect(out[0].kind).toBe("retry");
  });

  it("favors weak topics and keeps at most two picks per topic", () => {
    const out = recommend({ ...base, weakTopics: ["graphs"], solvedByDifficulty: { easy: 40, medium: 30, hard: 0 }, limit: 6 });
    expect(out[0].problem.topic).toBe("graphs");
    expect(out[0].kind).toBe("weak_topic");
    expect(out.filter((r) => r.problem.topic === "graphs").length).toBeLessThanOrEqual(2);
  });

  it("uses LeetCode tag counts to find thin topics", () => {
    const names = [
      "Array",
      "Hash Table",
      "Two Pointers",
      "Sliding Window",
      "Stack",
      "Binary Search",
      "Linked List",
      "Tree",
      "Heap (Priority Queue)",
      "Graph Theory",
      "Backtracking",
      "Greedy",
      "Bit Manipulation",
      "Math",
    ];
    const topicSolves = topicSolvesFromTags([...names.map((name) => ({ name, count: 80 })), { name: "Dynamic Programming", count: 2 }]);
    expect(topicSolves["dynamic-programming"]).toBe(2);
    const out = recommend({ ...base, topicSolves, solvedByDifficulty: { easy: 60, medium: 70, hard: 5 } });
    expect(out.some((r) => r.problem.topic === "dynamic-programming" && r.kind === "low_coverage")).toBe(true);
  });

  it("honors explicit difficulty and topic choices, including hard problems for beginners", () => {
    const out = recommend({ ...base, difficulty: "hard", focusTopic: "trees-bst" });
    expect(out.length).toBeGreaterThan(2);
    expect(out.every((r) => r.problem.difficulty === "hard" && r.problem.topic === "trees-bst")).toBe(true);
  });

  it("prioritizes due reviews, confidence and retries over new problems", () => {
    const out = recommend({
      ...base,
      solved: new Set(["two-sum", "valid-palindrome"]),
      attempted: new Set(["coin-change"]),
      weakTopics: ["dynamic-programming"],
      practice: {
        "two-sum": { result: "solved_independently", confidence: 5, reviewDue: true },
        "valid-palindrome": { result: "solved_with_hints", confidence: 2, reviewDue: false },
      },
    });
    expect(out.slice(0, 3).map((r) => r.kind)).toEqual(["review_due", "build_confidence", "retry"]);
    expect(out[1].reason).toContain("2/5");
  });

  it("keeps confidently solved problems excluded when a review is not due", () => {
    const out = recommend({
      ...base,
      solved: new Set(["two-sum"]),
      practice: { "two-sum": { result: "solved_independently", confidence: 5, reviewDue: false } },
    });
    expect(out.some((r) => r.problem.slug === "two-sum")).toBe(false);
  });

  it("allows a solve with hints to be practiced independently", () => {
    const out = recommend({
      ...base,
      solved: new Set(["two-sum"]),
      practice: { "two-sum": { result: "solved_with_hints", confidence: null, reviewDue: false } },
    });
    expect(out[0]).toMatchObject({ problem: { slug: "two-sum" }, kind: "build_confidence" });
    expect(out[0].reason).toContain("with hints");
  });

  it("does not misclassify experienced users who solved few easy problems", () => {
    expect(difficultyWeights({ easy: 5, medium: 100, hard: 20 }).medium).toBe(1);
  });

  it("uses manual coverage for topics without LeetCode tags", () => {
    const out = recommend({ ...base, unpracticedTopics: ["intervals"], topicSolves: { graphs: 30 }, difficulty: "medium" });
    expect(out.some((r) => r.problem.topic === "intervals" && r.kind === "low_coverage")).toBe(true);
  });

  it("returns no picks for a zero limit or an unavailable topic/difficulty combination", () => {
    expect(recommend({ ...base, limit: 0 })).toEqual([]);
    expect(recommend({ ...base, focusTopic: "sliding-window", difficulty: "easy" })).toEqual([]);
  });

  it("returns an empty list when everything suitable is solved", () => {
    expect(recommend({ ...base, solved: new Set(CATALOG.map((p) => p.slug)) })).toEqual([]);
  });
});
