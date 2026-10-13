import source from "./study-problems.json";
import type { CatalogProblem, Difficulty, TopicSlug } from "./catalog";

export type StudyPlan = "blind75" | "neetcode150";
export const STUDY_PLANS = {
  blind75: {
    title: "Blind 75",
    description: "A focused set of 75 interview problems to build the core patterns.",
    url: "https://neetcode.io/practice/practice/blind75",
  },
  neetcode150: {
    title: "NeetCode 150",
    description: "Build on Blind 75 with 75 more problems across a broader range of patterns.",
    url: "https://neetcode.io/practice/practice/neetcode150",
  },
} as const;

// Our suggested learning connections, inspired by https://neetcode.io/roadmap/.
// Coordinates are for an accessible HTML-button graph; the edges are not prerequisites that lock topics.
export const ROADMAP_TOPICS = [
  {
    id: "arrays",
    title: "Arrays & Hashing",
    topic: "arrays-hash-maps",
    x: 290,
    y: 24,
    parents: [],
    hint: "Start with hash maps, frequency counts and array scans.",
  },
  {
    id: "pointers",
    title: "Two Pointers",
    topic: "two-pointers",
    x: 65,
    y: 132,
    parents: ["arrays"],
    hint: "Practice opposite-end scans and moving pointers.",
  },
  {
    id: "stack",
    title: "Stack",
    topic: "stacks-queues",
    x: 515,
    y: 132,
    parents: ["arrays"],
    hint: "Use a stack to remember earlier items and resolve nested work.",
  },
  {
    id: "window",
    title: "Sliding Window",
    topic: "sliding-window",
    x: 35,
    y: 240,
    parents: ["pointers"],
    hint: "Grow and shrink a window while maintaining a useful invariant.",
  },
  {
    id: "search",
    title: "Binary Search",
    topic: "binary-search",
    x: 290,
    y: 240,
    parents: ["pointers"],
    hint: "Search sorted data or narrow down a feasible answer.",
  },
  {
    id: "lists",
    title: "Linked List",
    topic: "linked-lists",
    x: 545,
    y: 240,
    parents: ["pointers", "stack"],
    hint: "Work on reversals, cycles, merges and pointer rewiring.",
  },
  {
    id: "trees",
    title: "Trees",
    topic: "trees-bst",
    x: 290,
    y: 348,
    parents: ["search", "lists"],
    hint: "Build confidence with traversals, recursion and binary search trees.",
  },
  {
    id: "tries",
    title: "Tries",
    topic: "trees-bst",
    x: 35,
    y: 456,
    parents: ["trees"],
    hint: "Organize strings by shared prefixes and search paths.",
  },
  {
    id: "heap",
    title: "Heap / Priority Queue",
    topic: "heaps",
    x: 290,
    y: 456,
    parents: ["trees"],
    hint: "Keep the next best item accessible for top-K and scheduling problems.",
  },
  {
    id: "backtracking",
    title: "Backtracking",
    topic: "recursion-backtracking",
    x: 545,
    y: 456,
    parents: ["trees"],
    hint: "Explore choices, undo them, and prune branches.",
  },
  {
    id: "intervals",
    title: "Intervals",
    topic: "intervals",
    x: 35,
    y: 564,
    parents: ["heap"],
    hint: "Sort, merge and schedule overlapping ranges.",
  },
  {
    id: "graphs",
    title: "Graphs",
    topic: "graphs",
    x: 290,
    y: 564,
    parents: ["heap", "backtracking"],
    hint: "Model relationships and practice BFS, DFS and topological order.",
  },
  {
    id: "dp1",
    title: "1-D Dynamic Programming",
    topic: "dynamic-programming",
    x: 545,
    y: 564,
    parents: ["backtracking"],
    hint: "Identify a state, a transition and reusable subproblems.",
  },
  {
    id: "math",
    title: "Math & Geometry",
    topic: "math",
    x: 35,
    y: 672,
    parents: ["intervals"],
    hint: "Practice matrix transforms, arithmetic and geometric patterns.",
  },
  {
    id: "advanced-graphs",
    title: "Advanced Graphs",
    topic: "graphs",
    x: 290,
    y: 672,
    parents: ["graphs"],
    hint: "Explore weighted paths, spanning trees and graph ordering.",
  },
  {
    id: "dp2",
    title: "2-D Dynamic Programming",
    topic: "dynamic-programming",
    x: 545,
    y: 672,
    parents: ["dp1", "graphs"],
    hint: "Track two dimensions of state for grids, strings and decisions.",
  },
  {
    id: "bits",
    title: "Bit Manipulation",
    topic: "bit-manipulation",
    x: 35,
    y: 780,
    parents: ["math"],
    hint: "Use bit masks, shifts and XOR to work with binary representations.",
  },
  {
    id: "greedy",
    title: "Greedy",
    topic: "greedy",
    x: 545,
    y: 780,
    parents: ["dp2"],
    hint: "Choose a local step and explain why it preserves the best outcome.",
  },
] as const satisfies readonly {
  id: string;
  title: string;
  topic: TopicSlug;
  x: number;
  y: number;
  parents: readonly string[];
  hint: string;
}[];
export type RoadmapTopicId = (typeof ROADMAP_TOPICS)[number]["id"];
export type StudyProblem = CatalogProblem & {
  group: RoadmapTopicId;
  blind75: boolean;
  video: string;
  premium: boolean;
  alternateUrl: string | null;
};

const groupByTitle = new Map(ROADMAP_TOPICS.map((topic) => [topic.title as string, topic]));
// Snapshot of NeetCode's MIT-licensed public metadata; attribution and license are in NEETCODE-LICENSE.txt.
export const STUDY_PROBLEMS: StudyProblem[] = source.map((problem) => {
  const group = groupByTitle.get(problem.group);
  if (!group) throw new Error(`Unknown study topic: ${problem.group}`);
  return { ...problem, difficulty: problem.difficulty as Difficulty, group: group.id, topic: group.topic };
});
export const studyProblemBySlug = new Map(STUDY_PROBLEMS.map((problem) => [problem.slug, problem]));
export function studyProblems(plan: StudyPlan) {
  return plan === "blind75" ? STUDY_PROBLEMS.filter((problem) => problem.blind75) : STUDY_PROBLEMS;
}
export function studyProgress(problems: readonly StudyProblem[], solved: ReadonlySet<string>) {
  const done = problems.filter((problem) => solved.has(problem.slug)).length;
  return { done, total: problems.length, percent: problems.length ? Math.round((done / problems.length) * 100) : 0 };
}
