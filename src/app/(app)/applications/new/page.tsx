import { randomUUID } from "node:crypto";
import { requireWorkspace } from "@/lib/auth/session";
import { loadSeasons } from "@/lib/data/seasons";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationForm, type FormInitial } from "../application-form";

export const metadata = { title: "New application" };

export default async function NewApplication({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { supabase, profile } = await requireWorkspace();
  const sp = await searchParams;
  const seasons = await loadSeasons(supabase, { season: profile.target_season, year: profile.target_year });

  let initial: FormInitial = {
    status: "prepared",
    season: profile.target_season,
    season_year: profile.target_year,
  };
  if (sp.job && /^[0-9a-f-]{36}$/i.test(sp.job)) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id,company,title,role_category,season,season_year,locations,work_mode,apply_url")
      .eq("id", sp.job)
      .maybeSingle();
    if (job) {
      initial = {
        ...initial,
        job_id: job.id,
        company_name: job.company,
        role_title: job.title,
        role_category: job.role_category,
        season: job.season ?? initial.season,
        season_year: job.season_year ?? initial.season_year,
        locations: job.locations ?? [],
        work_mode: job.work_mode,
        application_url: job.apply_url,
        status: "prepared",
      };
    }
  }
  return (
    <>
      <PageHeader
        title="New application"
        description="Saving or preparing a role does not count as submitted. You will attest to submission separately."
      />
      <div className="max-w-3xl">
        <ApplicationForm
          mode="create"
          initial={initial}
          idem={randomUUID()}
          seasons={seasons.tabs.map((t) => ({ key: t.key, label: t.label }))}
          defaultYear={profile.target_year}
        />
      </div>
    </>
  );
}
