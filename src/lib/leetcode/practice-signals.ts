import type { PracticeAttempt, PracticeProblem } from "@/lib/data/types";
import { CATALOG, catalogBySlug, type Difficulty } from "./catalog";
import type { RecommendInput } from "./recommend";
import { STUDY_PROBLEMS, studyProblemBySlug } from "./study-plans";
import { leetcodeSlug } from "@/lib/validation/practice";

const normalize = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const byTitle = new Map([...STUDY_PROBLEMS, ...CATALOG].map((problem) => [normalize(problem.title), problem]));

export function practiceSignals(problems: readonly PracticeProblem[], attempts: readonly PracticeAttempt[], today: string) {
  const solved = new Set<string>();
  const attempted = new Set<string>();
  const solvedByDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const practice: Record<string, NonNullable<RecommendInput["practice"]>[string]> = {};
  const latest = new Map<string, PracticeAttempt>();
  const solvedIds = new Set<string>();
  for (const attempt of attempts) {
    const previous = latest.get(attempt.problem_id);
    if (!previous || attempt.practiced_at > previous.practiced_at) latest.set(attempt.problem_id, attempt);
    if (["solved_independently", "solved_with_hints"].includes(attempt.result)) solvedIds.add(attempt.problem_id);
  }
  const latestBySlug = new Map<string, PracticeAttempt>();
  const counted = new Set<string>();
  for (const problem of problems) {
    const key = problem.slug ?? leetcodeSlug(problem.url ?? undefined) ?? "";
    const catalog = catalogBySlug.get(key) ?? studyProblemBySlug.get(key) ?? byTitle.get(normalize(problem.title));
    const slug = catalog?.slug;
    if (solvedIds.has(problem.id)) {
      if (slug) solved.add(slug);
      const difficulty = problem.difficulty === "unknown" ? catalog?.difficulty : problem.difficulty;
      const identity = slug ?? problem.id;
      if (difficulty && !counted.has(identity)) {
        solvedByDifficulty[difficulty] += 1;
        counted.add(identity);
      }
    }
    const attempt = latest.get(problem.id);
    if (!slug || !attempt) continue;
    attempted.add(slug);
    const previous = latestBySlug.get(slug);
    if (!previous || attempt.practiced_at > previous.practiced_at) latestBySlug.set(slug, attempt);
  }
  for (const [slug, attempt] of latestBySlug) {
    practice[slug] = {
      result: attempt.result,
      confidence: attempt.confidence,
      reviewDue: !!attempt.next_review_date && attempt.next_review_date <= today,
    };
  }
  for (const slug of solved) attempted.delete(slug);
  return { solved, attempted, solvedByDifficulty, practice };
}
