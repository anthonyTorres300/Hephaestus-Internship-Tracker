// Synthetic UI fixture installed temporarily by scripts/ui-review.ts; never deployed.
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationsList } from "@/app/(app)/applications/applications-list";
import { JobRow } from "@/app/(app)/jobs/job-ui";
import { CreateFollowUp } from "@/app/(app)/dashboard/task-controls";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ApplicationForm } from "@/app/(app)/applications/application-form";
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
          title={view === "new" ? "New application" : view === "jobs" ? "Jobs" : "Applications"}
          description="Local layout review with synthetic data."
          actions={
            <>
              <RefreshButton />
              <CreateFollowUp apps={apps.map((a) => ({ id: a.id, label: a.company_name }))} today="2026-10-13" />
            </>
          }
        />
        {view === "jobs" ? (
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
