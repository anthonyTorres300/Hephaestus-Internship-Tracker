import type { SupabaseClient } from "@supabase/supabase-js";
import type { DsaTopic, PracticeAttempt, PracticeProblem } from "@/lib/data/types";
import { practiceSummary, type ProblemRow, type AttemptRow } from "@/lib/domain";
import { fetchAll } from "@/lib/data/export";

export async function loadPractice(supabase: SupabaseClient, tz: string, weeklyGoal: number, now = new Date()) {
  const [problems, attempts, links, topics] = await Promise.all([
    fetchAll<PracticeProblem>(supabase, "practice_problems"),
    fetchAll<PracticeAttempt>(supabase, "practice_attempts", "practiced_at"),
    fetchAll<{ problem_id: string; topic_id: number }>(supabase, "problem_topics", "problem_id"),
    supabase
      .from("dsa_topics")
      .select("*")
      .order("sort_order")
      .then((r) => (r.data ?? []) as DsaTopic[]),
  ]);
  const topicIdsByProblem = new Map<string, string[]>();
  for (const l of links) topicIdsByProblem.set(l.problem_id, [...(topicIdsByProblem.get(l.problem_id) ?? []), String(l.topic_id)]);
  const problemRows: ProblemRow[] = problems.map((p) => ({
    id: p.id,
    difficulty: p.difficulty,
    topic_ids: topicIdsByProblem.get(p.id) ?? [],
  }));
  const attemptRows: AttemptRow[] = attempts.map((a) => ({
    id: a.id,
    problem_id: a.problem_id,
    practiced_at: a.practiced_at,
    result: a.result,
    confidence: a.confidence,
    next_review_date: a.next_review_date,
  }));
  const summary = practiceSummary(
    attemptRows,
    problemRows,
    topics.map((t) => ({ id: String(t.id), name: t.title })),
    { now, tz, weeklyGoal },
  );
  return { problems, attempts, topics, summary, topicIdsByProblem };
}
