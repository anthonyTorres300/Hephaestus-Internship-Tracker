import { DateTime } from "luxon";
import { Trash2 } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import { loadPractice } from "@/lib/data/practice";
import { leetcodeUsername } from "@/lib/auth/display-name";
import { fetchLeetCodeProfile } from "@/lib/leetcode/client";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";
import { OTHER_COLOR, PIE_COLORS } from "@/lib/ui/chart-colors";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { PieBreakdown } from "@/components/charts/pie-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateOnly, fmtInstant, fmtWeek } from "@/lib/ui/format";
import { LogAttemptDialog } from "./log-attempt-dialog";
import { LeetCodeCard } from "./leetcode-card";
import { RecommendedCard } from "./recommended-card";
import { CATALOG, catalogBySlug, type Difficulty, type TopicSlug } from "@/lib/leetcode/catalog";
import { recommend, topicSolvesFromTags } from "@/lib/leetcode/recommend";
import { deleteAttemptAction } from "./actions";

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
  const [{ problems, attempts, topics, summary: s }, lc] = await Promise.all([
    loadPractice(supabase, profile.timezone, profile.weekly_practice_goal, now),
    lcName ? fetchLeetCodeProfile(lcName) : Promise.resolve(null),
  ]);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const recent = [...attempts].sort((a, b) => b.practiced_at.localeCompare(a.practiced_at)).slice(0, 6);
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

  // --- Recommendations: what the user has solved/attempted (manual log + LeetCode), which topics are thin, and what difficulty fits. ---
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const catalogByTitle = new Map(CATALOG.map((c) => [norm(c.title), c.slug]));
  const toCatalogSlug = (p: { slug: string | null; title: string }) =>
    p.slug && catalogBySlug.has(p.slug) ? p.slug : (catalogByTitle.get(norm(p.title)) ?? null);
  const solvedProblemIds = new Set(
    attempts.filter((a) => a.result === "solved_independently" || a.result === "solved_with_hints").map((a) => a.problem_id),
  );
  const attemptedProblemIds = new Set(attempts.map((a) => a.problem_id));
  const solvedSlugs = new Set<string>();
  const attemptedSlugs = new Set<string>();
  const manualSolvedByDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const p of problems) {
    const slug = toCatalogSlug(p);
    if (solvedProblemIds.has(p.id)) {
      if (slug) solvedSlugs.add(slug);
      if (p.difficulty !== "unknown") manualSolvedByDifficulty[p.difficulty] += 1;
    } else if (attemptedProblemIds.has(p.id) && slug) attemptedSlugs.add(slug);
  }
  const lcOk = lc?.ok ? lc.profile : null;
  for (const r of lcOk?.recent ?? []) solvedSlugs.add(r.slug);
  const topicSlugById = new Map(topics.map((t) => [String(t.id), t.slug as TopicSlug]));
  const recs = recommend({
    solved: solvedSlugs,
    attempted: attemptedSlugs,
    weakTopics: s.weakTopics.map((t) => topicSlugById.get(t.topic.id)).filter((x): x is TopicSlug => !!x),
    unpracticedTopics: s.unpracticedTopics.map((t) => topicSlugById.get(t.id)).filter((x): x is TopicSlug => !!x),
    topicSolves: lcOk && lcOk.solved.all >= 30 ? topicSolvesFromTags(lcOk.tags) : null,
    solvedByDifficulty: lcOk ? { easy: lcOk.solved.easy, medium: lcOk.solved.medium, hard: lcOk.solved.hard } : manualSolvedByDifficulty,
    limit: 6,
  });
  const logProblem = sp.log ? catalogBySlug.get(sp.log) : undefined;

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
        actions={
          <LogAttemptDialog
            key={logProblem?.slug ?? "none"}
            topics={topics}
            language={profile.preferred_language}
            nowLocal={nowLocal}
            knownTitles={problems.map((p) => p.title).slice(0, 500)}
            defaultOpen={!!logProblem}
            prefill={logProblem ? { title: logProblem.title, url: `https://leetcode.com/problems/${logProblem.slug}/` } : undefined}
          />
        }
      />

      <section aria-label="Summary" className="mb-5 rounded-lg bg-card px-4 py-3 ring-1 ring-white/10">
        <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
          {stats.map((x) => (
            <div key={x.label} className="grid gap-0.5 sm:px-4 sm:first:pl-0 sm:last:pr-0" title={x.hint}>
              <dt className={LABEL}>{x.label}</dt>
              <dd className="text-3xl font-light tracking-tight tabular-nums">{x.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardContent className="grid gap-3">
            <h2 className={LABEL}>Recent attempts</h2>
            {recent.length === 0 ? (
              <EmptyState title="No attempts yet">Use “Log attempt” after your next problem.</EmptyState>
            ) : (
              <ul className="grid">
                {recent.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 border-t border-white/5 py-1.5 text-sm first:border-t-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{byId.get(a.problem_id)?.title ?? "Problem"}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtInstant(a.practiced_at, profile.timezone)}
                        {a.duration_minutes != null ? ` · ${a.duration_minutes} min` : ""}
                        {a.confidence ? ` · confidence ${a.confidence}/5` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={a.result === "solved_independently" ? "secondary" : "outline"}>{RESULT_LABEL[a.result]}</Badge>
                      <form action={deleteAttemptAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete attempt for ${byId.get(a.problem_id)?.title ?? "problem"}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="grid gap-4">
            <h2 className={LABEL}>Your attempts</h2>
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
            {attention > 0 ? (
              <div className="grid gap-1 border-t border-white/10 pt-3 text-sm">
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
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <RecommendedCard recs={recs} connected={!!lcOk} />
      </div>

      <div className="mt-6">
        <LeetCodeCard username={lcName} result={lc} tz={profile.timezone} />
      </div>

      <details className="mt-6 rounded-lg bg-card ring-1 ring-white/10">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase">More</summary>
        <div className="grid gap-6 border-t border-white/10 p-4">
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
