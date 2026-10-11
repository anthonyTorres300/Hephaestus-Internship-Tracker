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

  it("returns an empty list when everything suitable is solved", () => {
    expect(recommend({ ...base, solved: new Set(CATALOG.map((p) => p.slug)) })).toEqual([]);
  });
});
