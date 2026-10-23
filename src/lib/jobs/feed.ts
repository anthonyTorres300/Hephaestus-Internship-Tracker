import { HOT_COMPANY_MATCHERS, matchHot } from "@/lib/jobs/hot-companies";
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
  applicationId?: string | null;
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
    let query = supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .is("superseded_by", null)
      .eq("country", "US")
      .neq("availability", "source_closed")
      .neq("availability", "missing_from_source");
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
      .select("id, job_id, company_name, role_title, season_year, confirmed_identity")
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
      applicationId: apps.find((a) => a.job_id === job.id || (!!job.identity_key && a.confirmed_identity === job.identity_key))?.id ?? null,
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

export interface FeedPageFilters extends FeedFilters {
  company?: string;
  hot?: boolean;
  tab?: "all" | "new" | "saved";
}
export async function loadFeedPage(
  supabase: SupabaseClient,
  profile: Profile,
  filters: FeedPageFilters,
  requestedPage = 1,
  now = new Date(),
) {
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000000) : 1;
  const { data, error } = await supabase.rpc("jobs_feed_page", {
    p_filters: { ...filters, categories: ROLE_GROUPS[filters.role ?? "all"].categories },
    p_page: safePage,
    p_per: 25,
    p_hot: HOT_COMPANY_MATCHERS,
  });
  if (error) {
    // Allows a rolling deployment: old databases work until the new migration is applied.
    if (error.code !== "PGRST202" && error.code !== "42883") throw new Error("jobs_query_failed");
    const all = await loadFeed(supabase, profile, filters, now);
    const companies = new Map<string, number>();
    for (const item of all) {
      const name = matchHot(item.job.company);
      if (name) companies.set(name, (companies.get(name) ?? 0) + 1);
    }
    const filtered = all.filter(
      (i) => (!filters.company || matchHot(i.job.company) === filters.company) && (!filters.hot || !!matchHot(i.job.company)),
    );
    const newer = filtered.filter((i) => now.getTime() - new Date(i.job.first_seen_at).getTime() <= 48 * 3600_000);
    const saved = filtered.filter((i) => i.userJob?.saved);
    const items = filters.tab === "new" ? newer : filters.tab === "saved" ? saved : filtered;
    const page = Math.min(safePage, Math.max(1, Math.ceil(items.length / 25)));
    return {
      items: items.slice((page - 1) * 25, page * 25),
      total: items.length,
      page,
      counts: { all: filtered.length, new: newer.length, saved: saved.length },
      companies: [...companies].map(([name, n]) => ({ name, n })),
      paged: false,
    };
  }
  const result = data as {
    rows: (Job & { user_job: UserJob | null; application_id: string | null; possible_previous: boolean })[];
    total: number;
    page: number;
    counts: { all: number; new: number; saved: number };
    companies: { name: string; n: number }[];
  };
  const ids = result.rows.map((j) => j.id);
  const overlayResult = ids.length
    ? await supabase.from("job_availability_overlay").select("job_id,verified_state,verified_at").in("job_id", ids)
    : { data: [], error: null };
  if (overlayResult.error) throw new Error("jobs_overlay_query_failed");
  const overlay = new Map((overlayResult.data ?? []).map((r) => [r.job_id, r]));
  const items: FeedItem[] = result.rows.map((job) => {
    const o = overlay.get(job.id);
    return {
      job,
      ...evaluate(profile, job, now),
      userJob: job.user_job,
      applicationId: job.application_id,
      applied: !!job.application_id,
      possiblePrevious: job.possible_previous,
      reviewerVerification: o?.verified_state ? { state: o.verified_state as "open" | "closed", verified_at: o.verified_at } : null,
      seasonMatch:
        job.season == null || job.season_year == null
          ? "unknown"
          : job.season === profile.target_season && job.season_year === profile.target_year
            ? "match"
            : "other",
    };
  });
  return { items, total: result.total, page: result.page, counts: result.counts, companies: result.companies, paged: true };
}
