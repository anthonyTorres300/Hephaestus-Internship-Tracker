import { DateTime } from "luxon";
import { requireWorkspace } from "@/lib/auth/session";
import { loadPractice } from "@/lib/data/practice";
import { leetcodeUsername } from "@/lib/auth/display-name";
import { fetchLeetCodeProfile } from "@/lib/leetcode/client";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";
import { OTHER_COLOR, PIE_COLORS } from "@/lib/ui/chart-colors";
import { PageHeader } from "@/components/layout/page-header";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { PieBreakdown } from "@/components/charts/pie-breakdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateOnly, fmtWeek } from "@/lib/ui/format";
import { LogAttemptDialog } from "./log-attempt-dialog";
import { LeetCodeCard } from "./leetcode-card";
import { StudyPlansCard } from "./study-plans-card";
import { studyProblemBySlug } from "@/lib/leetcode/study-plans";
import { RecommendedCard } from "./recommended-card";
import { catalogBySlug, type TopicSlug } from "@/lib/leetcode/catalog";
import { topicSolvesFromTags } from "@/lib/leetcode/recommend";
import { AttemptsCard } from "./attempts-card";
import { practiceSignals } from "@/lib/leetcode/practice-signals";

export const metadata = { title: "Practice" };

const RESULT_LABEL = {
  solved_independently: "Solved independently",
  solved_with_hints: "With hints",
  reviewed_solution: "Reviewed solution",
  unsolved: "Unsolved",
} as const;

const LABEL = "text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

export default async function Practice({ searchParams }: { searchParams: Promise<{ log?: string }> }) {
  const { supabase, profile, user } = await requireWorkspace();
  const sp = await searchParams;
  const now = new Date();
  const lcName = leetcodeUsername(user);
  const [{ problems, attempts, topics, summary: s, topicIdsByProblem }, lc] = await Promise.all([
    loadPractice(supabase, profile.timezone, profile.weekly_practice_goal, now),
    lcName ? fetchLeetCodeProfile(lcName) : Promise.resolve(null),
  ]);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const topicById = new Map(topics.map((topic) => [String(topic.id), topic.title]));
  const loggedAttempts = [...attempts]
    .sort((a, b) => b.practiced_at.localeCompare(a.practiced_at))
    .map((attempt) => ({
      attempt,
      problem: byId.get(attempt.problem_id) ?? null,
      topics: (topicIdsByProblem.get(attempt.problem_id) ?? []).map((id) => topicById.get(id)).filter((title): title is string => !!title),
    }));
  const nowLocal = DateTime.fromJSDate(now, { zone: profile.timezone }).toFormat("yyyy-LL-dd'T'HH:mm");
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

  const byResult = (r: keyof typeof RESULT_LABEL) => attempts.filter((a) => a.result === r).length;
  const resultPie = [
    { name: RESULT_LABEL.solved_independently, value: byResult("solved_independently"), color: PIE_COLORS[0] },
    { name: RESULT_LABEL.solved_with_hints, value: byResult("solved_with_hints"), color: PIE_COLORS[1] },
    { name: RESULT_LABEL.reviewed_solution, value: byResult("reviewed_solution"), color: PIE_COLORS[2] },
    { name: RESULT_LABEL.unsolved, value: byResult("unsolved"), color: PIE_COLORS[3] },
  ];
  const mix = s.difficultyMix;
  const difficultyPie = [
    { name: "Easy", value: mix.easy, color: DIFFICULTY_COLORS.easy },
    { name: "Medium", value: mix.medium, color: DIFFICULTY_COLORS.medium },
    { name: "Hard", value: mix.hard, color: DIFFICULTY_COLORS.hard },
    { name: "Not set", value: mix.unknown, color: OTHER_COLOR },
  ];
  const attention = s.weakTopics.length + s.dueReviews.length;

  const signals = practiceSignals(problems, attempts, nowLocal.slice(0, 10));
  const lcOk = lc?.ok ? lc.profile : null;
  for (const r of lcOk?.recent ?? []) signals.solved.add(r.slug);
  const topicSlugById = new Map(topics.map((t) => [String(t.id), t.slug as TopicSlug]));
  const recommendationInput = {
    ...signals,
    weakTopics: s.weakTopics.map((t) => topicSlugById.get(t.topic.id)).filter((x): x is TopicSlug => !!x),
    unpracticedTopics: s.unpracticedTopics.map((t) => topicSlugById.get(t.id)).filter((x): x is TopicSlug => !!x),
    topicSolves: lcOk && lcOk.solved.all >= 30 ? topicSolvesFromTags(lcOk.tags) : null,
    // Totals can overlap, so use the larger source instead of adding them.
    solvedByDifficulty: {
      easy: Math.max(lcOk?.solved.easy ?? 0, signals.solvedByDifficulty.easy),
      medium: Math.max(lcOk?.solved.medium ?? 0, signals.solvedByDifficulty.medium),
      hard: Math.max(lcOk?.solved.hard ?? 0, signals.solvedByDifficulty.hard),
    },
  };
  const logProblem = sp.log ? (studyProblemBySlug.get(sp.log) ?? catalogBySlug.get(sp.log)) : undefined;

  const stats = [
    {
      label: "This week",
      value: `${s.thisWeek.attempts}/${s.thisWeek.goal}`,
      hint: `Attempts vs your weekly goal (weeks start Monday, ${profile.timezone}).`,
    },
    { label: "Streak", value: `${s.streak}d`, hint: "Consecutive local days with an attempt, ending today or yesterday." },
    {
      label: "Solved alone",
      value: String(s.distinctIndependentlySolved),
      hint: "Distinct problems solved independently. Hints and reviewed solutions are excluded.",
    },
    { label: "Reviews due", value: String(s.dueReviews.length), hint: "Problems whose next review date has arrived." },
  ];

  return (
    <>
      <PageHeader
        title="Practice"
        description="Build your skills, one focused session at a time."
        actions={
          <LogAttemptDialog
            key={logProblem?.slug ?? "none"}
            topics={topics}
            language={profile.preferred_language}
            nowLocal={nowLocal}
            knownTitles={problems.map((p) => p.title).slice(0, 500)}
            defaultOpen={!!logProblem}
            prefill={
              logProblem
                ? {
                    title: logProblem.title,
                    url: `https://leetcode.com/problems/${logProblem.slug}/`,
                    difficulty: logProblem.difficulty,
                    topicIds: topics.filter((topic) => topic.slug === logProblem.topic).map((topic) => topic.id),
                  }
                : undefined
            }
          />
        }
      />

      <section aria-label="Summary" className="mb-5 rounded-lg bg-card px-4 py-3 ring-1 ring-border">
        <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
          {stats.map((x) => (
            <div key={x.label} className="grid gap-0.5 sm:px-4 sm:first:pl-0 sm:last:pr-0" title={x.hint}>
              <dt className={LABEL}>{x.label}</dt>
              <dd className="text-3xl font-light tracking-tight tabular-nums">{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-6">
        <RecommendedCard input={recommendationInput} connected={!!lcOk} />
      </div>

      <div className="mb-6">
        <StudyPlansCard solved={[...signals.solved]} attempted={[...signals.attempted]} connected={!!lcOk} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttemptsCard entries={loggedAttempts} tz={profile.timezone} />

        <Card size="sm">
          <CardContent className="grid gap-4">
            <h2 className={LABEL}>Practice insights</h2>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">Results & difficulty breakdown</summary>
              <div className="mt-4 grid gap-5">
                <PieBreakdown
                  title="Attempts by result"
                  data={resultPie}
                  size={104}
                  centerValue={attempts.length}
                  centerLabel="attempts"
                  empty="Log an attempt to see this."
                />
                <PieBreakdown
                  title="Problems by difficulty"
                  data={difficultyPie}
                  size={104}
                  centerValue={s.distinctProblems}
                  centerLabel="problems"
                  empty="Nothing logged yet."
                />
              </div>
            </details>
            {attention > 0 ? (
              <div className="grid gap-1 border-t border-border pt-3 text-sm">
                <h3 className={LABEL}>Needs attention</h3>
                {s.weakTopics.map((t) => (
                  <p key={t.topic.id}>
                    <span className="font-medium">{t.topic.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {t.independentAttempts}/{t.attempts} independent
                      {t.avgConfidence != null ? `, confidence ${t.avgConfidence.toFixed(1)}` : ""}
                    </span>
                  </p>
                ))}
                {s.dueReviews.map((r) => (
                  <p key={r.id}>
                    <span className="font-medium">{byId.get(r.problem_id)?.title ?? "Problem"}</span>{" "}
                    <span className="text-muted-foreground">review due {fmtDateOnly(r.next_review_date)}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No reviews due or weak topics flagged. Log confidence and a review date to make your next picks more personal.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <LeetCodeCard username={lcName} result={lc} tz={profile.timezone} />
      </div>

      <details className="mt-6 rounded-lg bg-card ring-1 ring-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Practice trends & topics
        </summary>
        <div className="grid gap-6 border-t border-border p-4">
          <div>
            <h2 className="mb-2 text-base">Attempts per week</h2>
            <BarSeriesChart
              title="Attempts per week"
              valueLabel="Attempts"
              height={160}
              data={s.attemptsPerWeek.map((w) => ({ label: fmtWeek(w.weekStart), value: w.count }))}
            />
          </div>

          <div>
            <h2 className="mb-1 text-base">Topics</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              An attempt counts toward every topic it is tagged with, so topic counts are not additive. Under 5 attempts is limited data.
            </p>
            {s.topics.filter((t) => t.attempts > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">Tag topics when you log an attempt to see how each one is going.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Independent</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Avg confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.topics
                      .filter((t) => t.attempts > 0)
                      .map((t) => (
                        <TableRow key={t.topic.id}>
                          <TableCell className="font-medium">
                            {t.topic.name} {t.limitedData ? <Badge variant="outline">limited data</Badge> : null}
                          </TableCell>
                          <TableCell>{t.attempts}</TableCell>
                          <TableCell>
                            {t.independentAttempts} of {t.attempts}
                          </TableCell>
                          <TableCell>{pct(t.independentRate)}</TableCell>
                          <TableCell>{t.avgConfidence == null ? "—" : t.avgConfidence.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {s.unpracticedTopics.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Not practiced yet (not a proven weakness): {s.unpracticedTopics.map((t) => t.name).join(", ")}.
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </>
  );
}
