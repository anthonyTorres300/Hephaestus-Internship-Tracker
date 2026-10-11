import { z } from "zod";

// Read-only use of LeetCode's PUBLIC profile data by username. No password, cookie or token is ever requested or sent.
// This is an unofficial interface and can change or rate-limit without notice, so every failure degrades to a message.
export const LEETCODE_USERNAME = /^[A-Za-z0-9_-]{1,30}$/;
const ENDPOINT = "https://leetcode.com/graphql";
const MAX_BYTES = 512 * 1024;

const QUERY = `query u($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    username
    profile { ranking }
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
    tagProblemCounts {
      fundamental { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      advanced { tagName problemsSolved }
    }
    languageProblemCount { languageName problemsSolved }
    userCalendar { streak totalActiveDays submissionCalendar }
    badges { displayName }
  }
  recentAcSubmissionList(username: $username, limit: 8) { title titleSlug timestamp }
  userContestRanking(username: $username) { rating attendedContestsCount globalRanking topPercentage }
  userContestRankingHistory(username: $username) { attended rating contest { title startTime } }
}`;

const tag = z.object({ tagName: z.string(), problemsSolved: z.number() });
const diffCount = z.object({ difficulty: z.string(), count: z.number(), submissions: z.number().optional() });
const responseSchema = z.object({
  data: z
    .object({
      allQuestionsCount: z
        .array(z.object({ difficulty: z.string(), count: z.number() }))
        .nullable()
        .optional(),
      userContestRanking: z
        .object({
          rating: z.number().nullable().optional(),
          attendedContestsCount: z.number().nullable().optional(),
          globalRanking: z.number().nullable().optional(),
          topPercentage: z.number().nullable().optional(),
        })
        .nullable()
        .optional(),
      userContestRankingHistory: z
        .array(
          z.object({
            attended: z.boolean().nullable().optional(),
            rating: z.number().nullable().optional(),
            contest: z.object({ title: z.string(), startTime: z.number() }).nullable().optional(),
          }),
        )
        .nullable()
        .optional(),
      matchedUser: z
        .object({
          username: z.string(),
          profile: z.object({ ranking: z.number().nullable().optional() }).nullable().optional(),
          submitStats: z
            .object({ acSubmissionNum: z.array(diffCount), totalSubmissionNum: z.array(diffCount).optional() })
            .nullable()
            .optional(),
          languageProblemCount: z
            .array(z.object({ languageName: z.string(), problemsSolved: z.number() }))
            .nullable()
            .optional(),
          badges: z
            .array(z.object({ displayName: z.string() }))
            .nullable()
            .optional(),
          tagProblemCounts: z
            .object({ fundamental: z.array(tag).optional(), intermediate: z.array(tag).optional(), advanced: z.array(tag).optional() })
            .nullable()
            .optional(),
          userCalendar: z
            .object({
              streak: z.number().nullable().optional(),
              totalActiveDays: z.number().nullable().optional(),
              submissionCalendar: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .nullable(),
      recentAcSubmissionList: z
        .array(z.object({ title: z.string(), titleSlug: z.string(), timestamp: z.union([z.string(), z.number()]) }))
        .nullable()
        .optional(),
    })
    .nullable(),
});

export interface LeetCodeProfile {
  username: string;
  ranking: number | null;
  solved: { all: number; easy: number; medium: number; hard: number };
  tags: { name: string; count: number }[];
  streak: number | null;
  activeDays: number | null;
  recent: { title: string; slug: string; at: string }[];
  available: { all: number; easy: number; medium: number; hard: number };
  submissions: { accepted: number; total: number };
  languages: { name: string; count: number }[];
  calendar: { date: string; count: number }[];
  badges: string[];
  contest: {
    rating: number | null;
    attended: number;
    globalRanking: number | null;
    topPercentage: number | null;
    history: { title: string; rating: number; at: string }[];
  } | null;
}

const toDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

function parseCalendar(raw: string | null | undefined): { date: string; count: number }[] {
  if (!raw || raw.length > 200_000) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => ({ unix: Number(k), count: Number(v) }))
      .filter((x) => Number.isFinite(x.unix) && x.unix > 0 && Number.isFinite(x.count) && x.count > 0)
      .map((x) => ({ date: toDay(x.unix), count: Math.min(x.count, 10_000) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export type LeetCodeResult =
  { ok: true; profile: LeetCodeProfile } | { ok: false; reason: "invalid_username" | "not_found" | "unavailable" };

export async function fetchLeetCodeProfile(username: string, fetchImpl: typeof fetch = fetch): Promise<LeetCodeResult> {
  if (!LEETCODE_USERNAME.test(username)) return { ok: false, reason: "invalid_username" };
  let text: string;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (compatible; Hephaestus)",
      },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
      redirect: "error",
      signal: AbortSignal.timeout(7000),
      // Public data keyed by username: safe to cache briefly across requests.
      ...({ next: { revalidate: 600 } } as object),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    text = await res.text();
    if (text.length > MAX_BYTES) return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.data) return { ok: false, reason: "unavailable" };
  const user = parsed.data.data.matchedUser;
  if (!user) return { ok: false, reason: "not_found" };

  const byDifficulty = new Map((user.submitStats?.acSubmissionNum ?? []).map((d) => [d.difficulty.toLowerCase(), d.count]));
  const acSubs = (user.submitStats?.acSubmissionNum ?? []).find((d) => d.difficulty === "All")?.submissions ?? 0;
  const totalSubs = (user.submitStats?.totalSubmissionNum ?? []).find((d) => d.difficulty === "All")?.submissions ?? 0;
  const available = new Map((parsed.data.data.allQuestionsCount ?? []).map((d) => [d.difficulty.toLowerCase(), d.count]));
  const cr = parsed.data.data.userContestRanking;
  const attended = (parsed.data.data.userContestRankingHistory ?? []).filter((h) => h.attended && h.rating != null && h.contest);
  const tags = [
    ...(user.tagProblemCounts?.fundamental ?? []),
    ...(user.tagProblemCounts?.intermediate ?? []),
    ...(user.tagProblemCounts?.advanced ?? []),
  ]
    .filter((t) => t.problemsSolved > 0)
    .sort((a, b) => b.problemsSolved - a.problemsSolved)
    .map((t) => ({ name: t.tagName, count: t.problemsSolved }));

  return {
    ok: true,
    profile: {
      username: user.username,
      ranking: user.profile?.ranking ?? null,
      solved: {
        all: byDifficulty.get("all") ?? 0,
        easy: byDifficulty.get("easy") ?? 0,
        medium: byDifficulty.get("medium") ?? 0,
        hard: byDifficulty.get("hard") ?? 0,
      },
      tags,
      available: {
        all: available.get("all") ?? 0,
        easy: available.get("easy") ?? 0,
        medium: available.get("medium") ?? 0,
        hard: available.get("hard") ?? 0,
      },
      submissions: { accepted: acSubs, total: totalSubs },
      languages: (user.languageProblemCount ?? [])
        .filter((l) => l.problemsSolved > 0)
        .sort((a, b) => b.problemsSolved - a.problemsSolved)
        .map((l) => ({ name: l.languageName, count: l.problemsSolved })),
      calendar: parseCalendar(user.userCalendar?.submissionCalendar),
      badges: (user.badges ?? []).map((b) => b.displayName).slice(0, 12),
      contest:
        cr && (cr.attendedContestsCount ?? 0) > 0
          ? {
              rating: cr.rating ?? null,
              attended: cr.attendedContestsCount ?? 0,
              globalRanking: cr.globalRanking ?? null,
              topPercentage: cr.topPercentage ?? null,
              history: attended
                .map((h) => ({
                  title: h.contest!.title,
                  rating: Math.round(h.rating!),
                  at: new Date(h.contest!.startTime * 1000).toISOString(),
                }))
                .slice(-60),
            }
          : null,
      streak: user.userCalendar?.streak ?? null,
      activeDays: user.userCalendar?.totalActiveDays ?? null,
      recent: (parsed.data.data.recentAcSubmissionList ?? [])
        .filter((r) => /^[a-z0-9-]+$/.test(r.titleSlug))
        .map((r) => ({ title: r.title, slug: r.titleSlug, at: new Date(Number(r.timestamp) * 1000).toISOString() })),
    },
  };
}
