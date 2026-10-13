// Synthetic UI fixture installed temporarily by scripts/ui-review.ts; never deployed.
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationsList } from "@/app/(app)/applications/applications-list";
import { JobRow } from "@/app/(app)/jobs/job-ui";
import { CreateFollowUp } from "@/app/(app)/dashboard/task-controls";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ApplicationForm } from "@/app/(app)/applications/application-form";
import { RecommendedCard } from "@/app/(app)/practice/recommended-card";
import { LeetCodeCard } from "@/app/(app)/practice/leetcode-card";
import { StudyPlansCard } from "@/app/(app)/practice/study-plans-card";
import { AttemptsCard } from "@/app/(app)/practice/attempts-card";
import { LogAttemptDialog } from "@/app/(app)/practice/log-attempt-dialog";
import { notFound } from "next/navigation";
import type { FeedItem } from "@/lib/jobs/feed";

export default async function Review({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const view = (await searchParams).view;
  const apps = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      revision: 1,
      status: "applied" as const,
      company_name: "Example Company",
      role_title: "Software Engineer: Cloud and Distributed Backend Intern Opportunities for University Students",
      priority: "medium",
      sub: "Oct 13, 2026",
      seasonText: "Summer 2027",
    },
  ];
  const item: FeedItem = {
    job: {
      id: apps[0].id,
      company: apps[0].company_name,
      title: apps[0].role_title,
      season: "summer",
      season_year: 2027,
      locations: ["Remote"],
      first_seen_at: "2026-10-13T12:00:00Z",
      availability: "listed",
      apply_url: "https://example.com",
      role_category: "software", country: "US", work_mode: "remote", canonical_url: "https://example.com",
      requirements: {}, source_posted_year: null, source_posted_month: null, source_posted_day: null, source_posted_precision: "unknown",
      identity_key: null, last_seen_at: "2026-10-13T12:00:00Z",
    },
    eligibility: { result: "needs_review", rules: [] },
    score: { components: [], total: 50, recencyBasis: "first_seen", missingEvidence: [], priority: "medium", version: "v1" },
    userJob: null,
    applied: false,
    possiblePrevious: false,
    reviewerVerification: null,
    seasonMatch: "match",
  };
  return (
    <ToastProvider>
      <AppShell name="Example" email="example@example.test" isAdmin={false} logout={<button>Log out</button>}>
        <PageHeader
          title={view === "practice" ? "Practice" : view === "new" ? "New application" : view === "jobs" ? "Jobs" : "Applications"}
          description="Local layout review with synthetic data."
          actions={
            <>
              <RefreshButton />
              <CreateFollowUp apps={apps.map((a) => ({ id: a.id, label: a.company_name }))} today="2026-10-13" />
            </>
          }
        />
        {view === "practice" ? (
          <div className="grid gap-6">
            <RecommendedCard connected input={{
              solved: new Set(["two-sum", "valid-palindrome"]),
              attempted: new Set(["coin-change"]),
              weakTopics: ["graphs"], unpracticedTopics: ["intervals"], topicSolves: null,
              solvedByDifficulty: { easy: 40, medium: 20, hard: 0 },
              practice: {
                "two-sum": { result: "solved_independently", confidence: 5, reviewDue: true },
                "valid-palindrome": { result: "solved_with_hints", confidence: 2, reviewDue: false },
              },
            }} />
            <StudyPlansCard connected solved={["two-sum", "valid-palindrome", "valid-parentheses"]} attempted={["coin-change"]} />
            <AttemptsCard tz="America/Puerto_Rico" entries={Array.from({ length: 7 }, (_, index) => ({
              attempt: {
                id: `review-attempt-${index}`, problem_id: `review-problem-${index}`,
                practiced_at: `2026-10-${String(13 - index).padStart(2, "0")}T12:00:00Z`,
                duration_minutes: index === 0 ? 0 : null, duration_unknown: index !== 0,
                language: index === 0 ? "Python" : null,
                result: index === 0 ? "solved_with_hints" : "unsolved",
                confidence: index === 0 ? 3 : null,
                notes: index === 0 ? "Used a hash map.\nTime complexity: O(n).\n<script>alert('notes')</script>\n" + "long-note-".repeat(40) : null,
                next_review_date: index === 0 ? "2026-10-20" : null,
              },
              problem: { id: `review-problem-${index}`, platform: "leetcode", platform_id: null, slug: "two-sum", url: "https://leetcode.com/problems/two-sum/", title: index < 2 ? "Two Sum" : index === 6 ? "Older logged problem" : `Practice problem ${index}`, difficulty: "easy" },
              topics: index === 0 ? ["Arrays / Hash Maps"] : [],
            }))} />
            <LogAttemptDialog topics={[{ id: 1, slug: "arrays-hash-maps", title: "Arrays / Hash Maps", sort_order: 1 }]} language="Python" nowLocal="2026-10-13T12:00" knownTitles={[]} prefill={{ title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "easy", topicIds: [1] }} />
            <LeetCodeCard username="example" tz="America/Puerto_Rico" result={{ ok: true, profile: {
              username: "example", ranking: 120000, solved: { all: 65, easy: 40, medium: 20, hard: 5 },
              available: { all: 3000, easy: 800, medium: 1600, hard: 600 }, submissions: { accepted: 70, total: 110 },
              tags: [{ name: "Array", count: 30 }, { name: "Graph", count: 8 }],
              languages: [{ name: "Python3", count: 60 }, { name: "Java", count: 5 }],
              calendar: [{ date: "2026-10-12", count: 2 }, { date: "2026-10-13", count: 3 }],
              activeDays: 20, streak: 3, badges: ["October Challenge"],
              recent: [{ title: "Longest Substring Without Repeating Characters", slug: "longest-substring-without-repeating-characters", at: "2026-10-13T12:00:00Z" }],
              contest: { rating: 1500, attended: 2, globalRanking: 50000, topPercentage: 40, history: [{ title: "Contest 1", rating: 1400, at: "2026-10-01T12:00:00Z" }, { title: "Contest 2", rating: 1500, at: "2026-10-08T12:00:00Z" }] },
            } }} />
          </div>
        ) : view === "jobs" ? (
          <ul>
            <JobRow item={item} tz="America/Puerto_Rico" now={new Date("2026-10-13T14:00:00Z")} />
          </ul>
        ) : view === "new" ? (
          <ApplicationForm
            mode="create"
            idem="review-idem"
            initial={{ status: "applied", submitted_precision: "day", submitted_year: 2026, submitted_month: 10, submitted_day: 13 }}
          />
        ) : (
          <ApplicationsList apps={apps} today="2026-10-13" seasons={[]} canBulk sort="updated_at" dir="desc" sortHrefs={{ company_name: "/ui-review", status: "/ui-review", submitted_key: "/ui-review", priority: "/ui-review" }} />
        )}
      </AppShell>
    </ToastProvider>
  );
}
