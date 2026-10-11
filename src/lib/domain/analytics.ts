import { DateTime } from "luxon";
import { addDays, localDateIn, mondayOf, partialDateToIso, type DatePrecision } from "./dates";
import { STATUSES, isSubmittedStatus, type Status } from "./status";

export interface AppRow {
  id: string;
  status: Status;
  submitted_precision: DatePrecision | null;
  submitted_year: number | null;
  submitted_month: number | null;
  submitted_day: number | null;
  submission_date_unknown: boolean;
  season: string | null;
  season_year: number | null;
  trashed_at: string | null;
  archived_at: string | null;
}

export interface OfferEventRow {
  application_id: string;
}
export interface InterviewEventRow {
  application_id: string;
}
export interface StatusEventRow {
  application_id: string;
  to_status: Status;
}

export interface Cohort {
  seasonYear?: number;
  season?: string;
  includeUnclassified: boolean;
  includeArchived: boolean;
  allHistory: boolean;
}

const isUnclassified = (a: AppRow) => !a.season || a.season === "unknown" || a.season_year == null;

export function cohortFilter<T extends AppRow>(apps: readonly T[], cohort: Cohort): { apps: T[]; unclassified: number } {
  const visible = apps.filter((a) => !a.trashed_at && (cohort.includeArchived || !a.archived_at));
  const unclassified = visible.filter(isUnclassified).length;
  const selected = visible.filter((a) => {
    if (cohort.allHistory) return true;
    if (isUnclassified(a)) return cohort.includeUnclassified;
    return (
      (cohort.season === undefined || a.season === cohort.season) &&
      (cohort.seasonYear === undefined || a.season_year === cohort.seasonYear)
    );
  });
  return { apps: selected, unclassified };
}

const submitted = <T extends AppRow>(apps: readonly T[]) => apps.filter((a) => isSubmittedStatus(a.status));

export const submittedCount = (apps: readonly AppRow[], cohort: Cohort): number => submitted(cohortFilter(apps, cohort).apps).length;

export function pipelineCounts(apps: readonly AppRow[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const a of apps) if (!a.trashed_at) counts[a.status]++;
  return counts;
}

export interface WeeklyApplications {
  weeks: { weekStart: string; count: number }[];
  unallocated: number;
}

export function weeklyApplications(apps: readonly AppRow[], tz: string, weeks: number, now: Date): WeeklyApplications {
  const currentMonday = mondayOf(localDateIn(now, tz));
  const starts = Array.from({ length: weeks }, (_, i) => addDays(currentMonday, -7 * (weeks - 1 - i)));
  const counts = new Map(starts.map((s) => [s, 0]));
  let unallocated = 0;
  for (const a of submitted(apps)) {
    if (a.trashed_at) continue;
    const iso =
      a.submitted_precision === "day" && a.submitted_year && a.submitted_month && a.submitted_day
        ? partialDateToIso({ precision: "day", year: a.submitted_year, month: a.submitted_month, day: a.submitted_day })
        : null;
    if (!iso) {
      unallocated++;
      continue;
    }
    const monday = mondayOf(iso);
    if (counts.has(monday)) counts.set(monday, counts.get(monday)! + 1);
  }
  return { weeks: starts.map((weekStart) => ({ weekStart, count: counts.get(weekStart)! })), unallocated };
}

export interface OfferRate {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export function offerRate(apps: readonly AppRow[], offerEvents: readonly OfferEventRow[]): OfferRate {
  const subs = submitted(apps).filter((a) => !a.trashed_at);
  const withOffer = new Set(offerEvents.map((e) => e.application_id));
  const numerator = subs.filter((a) => withOffer.has(a.id)).length;
  return { numerator, denominator: subs.length, rate: subs.length ? numerator / subs.length : null };
}

export function interviewCount(
  apps: readonly AppRow[],
  interviewEvents: readonly InterviewEventRow[],
  statusEvents: readonly StatusEventRow[] = [],
): number {
  const ids = new Set(interviewEvents.map((e) => e.application_id));
  for (const e of statusEvents) if (e.to_status === "interview") ids.add(e.application_id);
  return apps.filter((a) => !a.trashed_at && ids.has(a.id)).length;
}

// ---------------------------------------------------------------- practice

export type AttemptResult = "solved_independently" | "solved_with_hints" | "reviewed_solution" | "unsolved";
export type Difficulty = "easy" | "medium" | "hard" | "unknown";

export interface AttemptRow {
  id: string;
  problem_id: string;
  practiced_at: string;
  result: AttemptResult;
  confidence: number | null;
  next_review_date: string | null;
}
export interface ProblemRow {
  id: string;
  difficulty: Difficulty;
  topic_ids: string[];
}
export interface TopicRow {
  id: string;
  name: string;
}

export interface PracticeOptions {
  now: Date;
  tz: string;
  from?: string;
  to?: string;
  weeklyGoal: number;
}

export interface TopicStats {
  topic: TopicRow;
  attempts: number;
  independentAttempts: number;
  independentRate: number | null;
  avgConfidence: number | null;
  limitedData: boolean;
}

export interface PracticeSummary {
  distinctProblems: number;
  distinctIndependentlySolved: number;
  attemptsPerWeek: { weekStart: string; count: number }[];
  difficultyMix: Record<Difficulty, number>;
  topics: TopicStats[];
  weakTopics: TopicStats[];
  unpracticedTopics: TopicRow[];
  dueReviews: AttemptRow[];
  streak: number;
  thisWeek: { weekStart: string; attempts: number; goal: number };
}

export const LIMITED_DATA_THRESHOLD = 5;

export function practiceSummary(
  attempts: readonly AttemptRow[],
  problems: readonly ProblemRow[],
  topics: readonly TopicRow[],
  opts: PracticeOptions,
): PracticeSummary {
  const { now, tz } = opts;
  const today = localDateIn(now, tz);
  const localDay = (a: AttemptRow) => DateTime.fromISO(a.practiced_at, { zone: "utc" }).setZone(tz).toISODate()!;
  const days = new Map(attempts.map((a) => [a.id, localDay(a)]));
  const inPeriod = attempts.filter((a) => {
    const d = days.get(a.id)!;
    return (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to);
  });
  const problemById = new Map(problems.map((p) => [p.id, p]));

  const problemIds = new Set(inPeriod.map((a) => a.problem_id));
  const independent = new Set(inPeriod.filter((a) => a.result === "solved_independently").map((a) => a.problem_id));
  const difficultyMix: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 };
  for (const id of problemIds) difficultyMix[problemById.get(id)?.difficulty ?? "unknown"]++;

  const weekCounts = new Map<string, number>();
  for (const a of inPeriod) {
    const w = mondayOf(days.get(a.id)!);
    weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
  }
  const attemptsPerWeek: PracticeSummary["attemptsPerWeek"] = [];
  if (inPeriod.length) {
    const sorted = [...weekCounts.keys()].sort();
    const first = opts.from ? mondayOf(opts.from) : sorted[0]!;
    const last = mondayOf(opts.to && opts.to < today ? opts.to : today);
    for (let w = first; w <= last; w = addDays(w, 7)) attemptsPerWeek.push({ weekStart: w, count: weekCounts.get(w) ?? 0 });
  }

  const stats = topics.map((topic): TopicStats => {
    const rows = inPeriod.filter((a) => problemById.get(a.problem_id)?.topic_ids.includes(topic.id));
    const independentAttempts = rows.filter((a) => a.result === "solved_independently").length;
    const confs = rows.map((a) => a.confidence).filter((c): c is number => c != null);
    return {
      topic,
      attempts: rows.length,
      independentAttempts,
      independentRate: rows.length ? independentAttempts / rows.length : null,
      avgConfidence: confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : null,
      limitedData: rows.length < LIMITED_DATA_THRESHOLD,
    };
  });
  const practiced = stats.filter((s) => s.attempts > 0);
  const weakTopics = practiced.filter(
    (s) => s.attempts >= LIMITED_DATA_THRESHOLD && (s.independentRate! < 0.5 || (s.avgConfidence !== null && s.avgConfidence < 3)),
  );

  const latest = new Map<string, AttemptRow>();
  for (const a of attempts) {
    const cur = latest.get(a.problem_id);
    if (!cur || Date.parse(a.practiced_at) > Date.parse(cur.practiced_at)) latest.set(a.problem_id, a);
  }
  const dueReviews = [...latest.values()].filter((a) => a.next_review_date && a.next_review_date <= today);

  const dayset = new Set(days.values());
  let cursor = dayset.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dayset.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const weekStart = mondayOf(today);
  const thisWeekAttempts = attempts.filter((a) => mondayOf(days.get(a.id)!) === weekStart).length;

  return {
    distinctProblems: problemIds.size,
    distinctIndependentlySolved: independent.size,
    attemptsPerWeek,
    difficultyMix,
    topics: practiced,
    weakTopics,
    unpracticedTopics: stats.filter((s) => s.attempts === 0).map((s) => s.topic),
    dueReviews,
    streak,
    thisWeek: { weekStart, attempts: thisWeekAttempts, goal: opts.weeklyGoal },
  };
}
