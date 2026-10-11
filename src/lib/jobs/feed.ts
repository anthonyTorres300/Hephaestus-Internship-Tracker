import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, Profile, UserJob } from "@/lib/data/types";
import { isGraduateOnly, ROLE_GROUPS, type RoleGroup } from "@/lib/jobs/prefs";
import {
  assessEligibility,
  isDefaultFeedVisible,
  scoreJob,
  type EligibilityAssessment,
  type JobFacts,
  type JobRequirements,
  type ScoreResult,
} from "@/lib/domain";

export const FEED_LIMIT = 2000;
const PAGE_ROWS = 1000; // PostgREST caps each response at 1,000 rows, so large result sets are fetched in pages
const MAX_CANDIDATES = 12_000;
const JOB_COLUMNS =
  "id,company,title,role_category,season,season_year,locations,country,work_mode,apply_url,canonical_url,identity_key,requirements,source_posted_year,source_posted_month,source_posted_day,source_posted_precision,first_seen_at,last_seen_at,availability";
export const VERIFICATION_STALE_DAYS = 7;

export interface FeedItem {
  job: Job;
  eligibility: EligibilityAssessment;
  score: ScoreResult;
  userJob: UserJob | null;
  applied: boolean;
  possiblePrevious: boolean;
  reviewerVerification: { state: "open" | "closed"; verified_at: string } | null;
  seasonMatch: "match" | "unknown" | "other";
}

export interface FeedFilters {
  q?: string;
  category?: string;
  role?: RoleGroup;
  undergradOnly?: boolean;
  eligibility?: "eligible" | "needs_review" | "ineligible";
  season?: "target" | "unknown" | "all";
  saved?: boolean;
  showHidden?: boolean;
  showApplied?: boolean;
  showIneligible?: boolean;
  sort?: "first_seen" | "posted" | "relevance";
  /** Only listings first seen at or after this ISO time (applied in the database). */
  firstSeenAfter?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const toJobFacts = (j: Job): JobFacts => ({
  company: j.company,
  title: j.title,
  role_category: j.role_category,
  season: j.season,
  season_year: j.season_year,
  locations: Array.isArray(j.locations) ? j.locations : [],
  country: j.country,
  work_mode: (["onsite", "hybrid", "remote"].includes(j.work_mode ?? "") ? j.work_mode : null) as JobFacts["work_mode"],
  requirements: (j.requirements ?? null) as JobRequirements | null,
  source_posted_at:
    j.source_posted_precision === "day" && j.source_posted_year
      ? `${j.source_posted_year}-${String(j.source_posted_month).padStart(2, "0")}-${String(j.source_posted_day).padStart(2, "0")}`
      : null,
  first_seen_at: j.first_seen_at,
});

export function evaluate(profile: Profile, j: Job, now: Date) {
  const facts = toJobFacts(j);
  const eligibility = assessEligibility(profile, facts);
  return { eligibility, score: scoreJob(profile, facts, eligibility, now) };
}

// Season, role type and category are filtered in the database BEFORE paging, so the newest listings never crowd out older matches.
export async function fetchCandidateJobs(supabase: SupabaseClient, profile: Profile, filters: FeedFilters): Promise<Job[]> {
  const out: Job[] = [];
  const cats = ROLE_GROUPS[filters.role ?? "all"].categories;
  for (let from = 0; from < MAX_CANDIDATES; from += PAGE_ROWS) {
    let query = supabase.from("jobs").select(JOB_COLUMNS).is("superseded_by", null).neq("availability", "source_closed");
    const want = filters.season ?? "target";
    if (want === "target") query = query.eq("season", profile.target_season).eq("season_year", profile.target_year);
    else if (want === "unknown") query = query.or("season.is.null,season_year.is.null");
    if (cats.length > 0) query = query.in("role_category", [...cats]);
    if (filters.category) query = query.eq("role_category", filters.category);
    if (filters.firstSeenAfter) query = query.gte("first_seen_at", filters.firstSeenAfter);
    const { data, error } = await query
      .order("first_seen_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_ROWS - 1);
    if (error) throw new Error("jobs_query_failed");
    out.push(...((data ?? []) as unknown as Job[]));
    if (!data || data.length < PAGE_ROWS) break;
  }
  return out;
}

export async function loadFeed(supabase: SupabaseClient, profile: Profile, filters: FeedFilters, now = new Date()): Promise<FeedItem[]> {
  const [jobs, ujRes, appsRes, overlayRes] = await Promise.all([
    fetchCandidateJobs(supabase, profile, filters),
    supabase.from("user_jobs").select("*").limit(20000),
    supabase
      .from("applications")
      .select("job_id, company_name, role_title, season_year, confirmed_identity")
      .is("trashed_at", null)
      .limit(2000),
    supabase
      .from("job_availability_overlay")
      .select("job_id, verified_state, verified_at")
      .not("verified_state", "is", null)
      .limit(FEED_LIMIT),
  ]);
  const userJobs = new Map(((ujRes.data ?? []) as UserJob[]).map((u) => [u.job_id, u]));
  const apps = appsRes.data ?? [];
  const linked = new Set(apps.map((a) => a.job_id).filter(Boolean) as string[]);
  const identities = new Set(apps.map((a) => a.confirmed_identity).filter(Boolean) as string[]);
  const previous = new Map<string, number[]>();
  for (const a of apps)
    previous.set(`${norm(a.company_name)}|${norm(a.role_title)}`, [
      ...(previous.get(`${norm(a.company_name)}|${norm(a.role_title)}`) ?? []),
      a.season_year ?? 0,
    ]);
  const overlay = new Map(
    (overlayRes.data ?? []).map((o) => [o.job_id as string, o as { verified_state: "open" | "closed"; verified_at: string }]),
  );
  const q = filters.q ? norm(filters.q) : "";

  const items: FeedItem[] = [];
  for (const job of jobs) {
    const uj = userJobs.get(job.id) ?? null;
    const applied = linked.has(job.id) || (!!job.identity_key && identities.has(job.identity_key));
    // Title-only matches never hide a role: they only add a "possible previous application" label. A Summer 2026 application does not match a 2027 job.
    const prevYears = previous.get(`${norm(job.company)}|${norm(job.title)}`);
    const possiblePrevious = !applied && !!prevYears && prevYears.some((y) => y === 0 || job.season_year == null || y === job.season_year);
    const seasonMatch: FeedItem["seasonMatch"] =
      job.season_year == null || !job.season
        ? "unknown"
        : job.season_year === profile.target_year && job.season === profile.target_season
          ? "match"
          : "other";

    if (filters.season !== "all") {
      const want = filters.season ?? "target";
      if (want === "target" && seasonMatch !== "match") continue;
      if (want === "unknown" && seasonMatch !== "unknown") continue;
    }
    if (q && !norm(`${job.company} ${job.title} ${(job.locations ?? []).join(" ")}`).includes(q)) continue;
    if (filters.category && job.role_category !== filters.category) continue;
    const roleCats: readonly string[] = ROLE_GROUPS[filters.role ?? "all"].categories;
    if (roleCats.length > 0 && !(job.role_category && roleCats.includes(job.role_category))) continue;
    if (filters.undergradOnly && isGraduateOnly(job)) continue;
    if (filters.saved && !uj?.saved) continue;
    if (!filters.showHidden && uj?.hidden) continue;
    if (!filters.showApplied && applied) continue;

    const { eligibility, score } = evaluate(profile, job, now);
    if (filters.eligibility && eligibility.result !== filters.eligibility) continue;
    if (!filters.showIneligible && !filters.eligibility && !isDefaultFeedVisible(eligibility.result)) continue;
    const o = overlay.get(job.id);
    items.push({
      job,
      eligibility,
      score,
      userJob: uj,
      applied,
      possiblePrevious,
      reviewerVerification: o ? { state: o.verified_state, verified_at: o.verified_at } : null,
      seasonMatch,
    });
  }

  const sort = filters.sort ?? "first_seen";
  items.sort((a, b) => {
    if (sort === "relevance") return b.score.total - a.score.total || b.job.first_seen_at.localeCompare(a.job.first_seen_at);
    if (sort === "posted") {
      const k = (j: Job) =>
        j.source_posted_precision === "day"
          ? `${j.source_posted_year}-${String(j.source_posted_month).padStart(2, "0")}-${String(j.source_posted_day).padStart(2, "0")}`
          : "";
      return k(b.job).localeCompare(k(a.job)) || b.job.first_seen_at.localeCompare(a.job.first_seen_at);
    }
    return b.job.first_seen_at.localeCompare(a.job.first_seen_at);
  });
  return items;
}

export function availabilityLabel(
  item: Pick<FeedItem, "job" | "userJob" | "reviewerVerification">,
  now = new Date(),
): { text: string; tone: "neutral" | "good" | "warn" } {
  const { job, userJob, reviewerVerification: rv } = item;
  const staleMs = VERIFICATION_STALE_DAYS * 86400_000;
  if (rv) {
    const stale = now.getTime() - new Date(rv.verified_at).getTime() > staleMs;
    return {
      text: `Reviewer marked ${rv.state} on ${new Date(rv.verified_at).toISOString().slice(0, 10)}${stale ? " (stale, re-check)" : ""}`,
      tone: rv.state === "open" && !stale ? "good" : "warn",
    };
  }
  if (userJob && userJob.verification_state !== "none" && userJob.verified_at) {
    const stale = now.getTime() - new Date(userJob.verified_at).getTime() > staleMs;
    return {
      text: `You marked ${userJob.verification_state} on ${userJob.verified_at.slice(0, 10)}${stale ? " (stale, re-check)" : ""}`,
      tone: userJob.verification_state === "open" && !stale ? "good" : "warn",
    };
  }
  if (job.availability === "source_closed") return { text: "Marked closed in the GitHub list", tone: "warn" };
  if (job.availability === "missing_from_source") return { text: "No longer in the GitHub list", tone: "warn" };
  return { text: "Listed on GitHub; employer availability unverified", tone: "neutral" };
}

export async function setUserJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  patch: Partial<Pick<UserJob, "saved" | "hidden" | "verification_state" | "verification_url" | "verification_note" | "verified_at">>,
) {
  const upd = await supabase.from("user_jobs").update(patch).eq("user_id", userId).eq("job_id", jobId).select("id");
  if (upd.error) return upd.error;
  if (upd.data?.length) return null;
  const ins = await supabase.from("user_jobs").insert({ user_id: userId, job_id: jobId, ...patch });
  return ins.error;
}
