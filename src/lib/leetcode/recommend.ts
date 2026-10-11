import { CATALOG, TOPIC_TITLES, type CatalogProblem, type Difficulty, type TopicSlug } from "@/lib/leetcode/catalog";

// LeetCode tag names (lower-case) that count toward each of our topics. Intervals has no matching tag, so it relies on manual practice only.
export const TOPIC_TAGS: Partial<Record<TopicSlug, string[]>> = {
  "arrays-hash-maps": ["array", "hash table"],
  "two-pointers": ["two pointers"],
  "sliding-window": ["sliding window"],
  "stacks-queues": ["stack", "queue", "monotonic stack"],
  "binary-search": ["binary search"],
  "linked-lists": ["linked list"],
  "trees-bst": ["tree", "binary tree", "binary search tree"],
  heaps: ["heap (priority queue)"],
  graphs: ["graph", "graph theory", "depth-first search", "breadth-first search"],
  "recursion-backtracking": ["backtracking", "recursion"],
  "dynamic-programming": ["dynamic programming"],
  greedy: ["greedy"],
  "bit-manipulation": ["bit manipulation"],
  math: ["math"],
};

export function topicSolvesFromTags(tags: { name: string; count: number }[]): Partial<Record<TopicSlug, number>> {
  const by = new Map(tags.map((t) => [t.name.toLowerCase(), t.count]));
  const out: Partial<Record<TopicSlug, number>> = {};
  for (const [topic, names] of Object.entries(TOPIC_TAGS) as [TopicSlug, string[]][])
    out[topic] = names.reduce((n, name) => n + (by.get(name) ?? 0), 0);
  return out;
}

export interface RecommendInput {
  /** Catalog slugs the user has solved (manual log or LeetCode). */
  solved: ReadonlySet<string>;
  /** Catalog slugs attempted but never solved. */
  attempted: ReadonlySet<string>;
  weakTopics: readonly TopicSlug[];
  unpracticedTopics: readonly TopicSlug[];
  /** Per-topic solve counts from the LeetCode profile; null when not connected or too little data. */
  topicSolves: Partial<Record<TopicSlug, number>> | null;
  solvedByDifficulty: Record<Difficulty, number>;
  limit?: number;
  catalog?: readonly CatalogProblem[];
}

export type RecommendationKind = "retry" | "weak_topic" | "low_coverage" | "next_step";

export interface Recommendation {
  problem: CatalogProblem;
  score: number;
  kind: RecommendationKind;
  reason: string;
}

export function difficultyWeights(d: Record<Difficulty, number>): Record<Difficulty, number> {
  if (d.easy < 30) return { easy: 1, medium: 0.6, hard: 0.05 };
  if (d.medium < 60) return { easy: 0.25, medium: 1, hard: 0.2 };
  if (d.medium < 150) return { easy: 0.1, medium: 1, hard: 0.6 };
  return { easy: 0, medium: 0.7, hard: 1 };
}

export function recommend(input: RecommendInput): Recommendation[] {
  const catalog = input.catalog ?? CATALOG;
  const limit = input.limit ?? 6;
  const weights = difficultyWeights(input.solvedByDifficulty);
  const weak = new Set(input.weakTopics);
  const unpracticed = new Set(input.unpracticedTopics);

  const solvesList = input.topicSolves ? Object.values(input.topicSolves).filter((n): n is number => typeof n === "number") : [];
  const positive = solvesList.filter((n) => n > 0);
  // Baseline: what a "covered" topic looks like for this user (average of topics they have solved in).
  const ref = positive.length ? Math.max(5, positive.reduce((a, b) => a + b, 0) / positive.length) : 0;
  const lcNeed = (topic: TopicSlug) => {
    const n = input.topicSolves?.[topic];
    return n == null || ref === 0 ? 0 : Math.max(0, Math.min(1, 1 - n / (ref * 0.6)));
  };
  const need = (topic: TopicSlug) =>
    Math.max(weak.has(topic) ? 1 : 0, unpracticed.has(topic) && !input.topicSolves ? 0.5 : 0, lcNeed(topic));

  const scored: Recommendation[] = [];
  catalog.forEach((problem, i) => {
    if (input.solved.has(problem.slug)) return;
    const retry = input.attempted.has(problem.slug);
    const n = need(problem.topic);
    const fit = weights[problem.difficulty];
    if (!retry && fit < 0.1) return;
    const score = 3 * n + 2 * fit + (retry ? 3 : 0) + (catalog.length - i) * 0.001;
    const topic = TOPIC_TITLES[problem.topic];
    const kind: RecommendationKind = retry ? "retry" : weak.has(problem.topic) ? "weak_topic" : n >= 0.5 ? "low_coverage" : "next_step";
    const reason =
      kind === "retry"
        ? "You tried this but have not solved it yet"
        : kind === "weak_topic"
          ? `Your ${topic} results need work`
          : kind === "low_coverage"
            ? `Little practice in ${topic} so far`
            : `A good next ${problem.difficulty} step`;
    scored.push({ problem, score, kind, reason });
  });

  scored.sort((a, b) => b.score - a.score);
  // Keep the list varied: at most two picks per topic unless it is a retry.
  const perTopic = new Map<TopicSlug, number>();
  const picked: Recommendation[] = [];
  for (const r of scored) {
    const used = perTopic.get(r.problem.topic) ?? 0;
    if (r.kind !== "retry" && used >= 2) continue;
    perTopic.set(r.problem.topic, used + 1);
    picked.push(r);
    if (picked.length >= limit) break;
  }
  return picked;
}
