import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, InterviewEvent, Note, OfferEvent, StatusEvent, Task } from "@/lib/data/types";
import { STATUSES } from "@/lib/domain";
import { parseSeasonKey } from "@/lib/data/seasons";

export const PAGE_SIZE = 25;
export const PAGE_SIZES = [25, 50, 100, 200] as const;

export interface AppFilters {
  q?: string;
  status?: string;
  season?: string; // "<name>:<year>" | "unclassified" | "all" (a bare "<year>" from old links still filters by year)
  location?: string;
  priority?: string;
  from?: string; // YYYY-MM
  to?: string; // YYYY-MM
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  per?: number;
  view?: "active" | "archived" | "trash";
}

const SORTS = new Set(["updated_at", "created_at", "company_name", "submitted_key", "status", "priority"]);

// Status and priority sort by pipeline rank, not alphabetically.
const SORT_COLUMN: Record<string, string> = { status: "status_rank", priority: "priority_rank" };

// Strip characters that carry meaning in PostgREST filter syntax / LIKE patterns.
const clean = (s: string) =>
  s
    .replace(/[%*,()\\_"']/g, " ")
    .trim()
    .slice(0, 80);

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  defaultSeason: string,
): AppFilters & { seasonValue: string } {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) || undefined;
  const sort = one("sort");
  const season = one("season") ?? defaultSeason;
  return {
    q: one("q"),
    status: (STATUSES as readonly string[]).includes(one("status") ?? "") ? one("status") : undefined,
    season,
    seasonValue: season,
    location: one("location"),
    priority: ["high", "medium", "low"].includes(one("priority") ?? "") ? one("priority") : undefined,
    from: /^\d{4}-\d{2}$/.test(one("from") ?? "") ? one("from") : undefined,
    to: /^\d{4}-\d{2}$/.test(one("to") ?? "") ? one("to") : undefined,
    sort: sort && SORTS.has(sort) ? sort : "updated_at",
    dir: one("dir") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(one("page")) || 1),
    per: (PAGE_SIZES as readonly number[]).includes(Number(one("per"))) ? Number(one("per")) : PAGE_SIZE,
    view: one("view") === "archived" ? "archived" : one("view") === "trash" ? "trash" : "active",
  };
}

type Q = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function applyFilters(q: Q, f: AppFilters): Q {
  let query = q;
  if (f.view === "trash") query = query.not("trashed_at", "is", null);
  else {
    query = query.is("trashed_at", null);
    query = f.view === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  }
  if (f.q) query = query.ilike("search_text", `%${clean(f.q).toLowerCase()}%`);
  if (f.status) query = query.eq("status", f.status);
  if (f.priority) query = query.eq("priority", f.priority);
  if (f.location) query = query.ilike("locations_text", `%${clean(f.location).toLowerCase()}%`);
  if (f.season === "unclassified") query = query.or("season.is.null,season_year.is.null");
  else if (f.season && f.season !== "all") {
    const sk = parseSeasonKey(f.season);
    if (sk) query = query.eq("season", sk.name).eq("season_year", sk.year);
    else if (/^\d{4}$/.test(f.season)) query = query.eq("season_year", Number(f.season));
  }
  if (f.from) query = query.gte("submitted_key", Number(f.from.replace("-", "")) * 100);
  if (f.to) query = query.lte("submitted_key", Number(f.to.replace("-", "")) * 100 + 99);
  return query;
}

export async function listApplications(supabase: SupabaseClient, f: AppFilters) {
  const page = f.page ?? 1;
  const per = f.per ?? PAGE_SIZE;
  const base = supabase.from("applications").select("*", { count: "exact" });
  const { data, count, error } = await applyFilters(base, f)
    .order(SORT_COLUMN[f.sort ?? "updated_at"] ?? f.sort ?? "updated_at", { ascending: f.dir === "asc", nullsFirst: false })
    // Stable tie-breaker so equal values (e.g. same priority) never look unsorted or reshuffle between pages.
    .order("updated_at", { ascending: false })
    .order("id")
    .range((page - 1) * per, page * per - 1);
  if (error) throw new Error("applications_query_failed");
  return { rows: (data ?? []) as Application[], total: count ?? 0, page, pageSize: per };
}

export async function getApplicationDetail(supabase: SupabaseClient, id: string) {
  const { data: app } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
  if (!app) return null;
  const [events, notes, interviews, offers, tasks, job] = await Promise.all([
    supabase.from("application_status_events").select("*").eq("application_id", id).order("recorded_at", { ascending: true }).order("id"),
    supabase.from("application_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("interview_events").select("*").eq("application_id", id).order("round_number").order("created_at"),
    supabase.from("offer_events").select("*").eq("application_id", id).order("created_at"),
    supabase.from("tasks").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    app.job_id
      ? supabase.from("jobs").select("id,company,title,canonical_url,availability").eq("id", app.job_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    app: app as Application,
    events: (events.data ?? []) as StatusEvent[],
    notes: (notes.data ?? []) as Note[],
    interviews: (interviews.data ?? []) as InterviewEvent[],
    offers: (offers.data ?? []) as OfferEvent[],
    tasks: (tasks.data ?? []) as Task[],
    job: job.data as { id: string; company: string; title: string; canonical_url: string | null; availability: string } | null,
  };
}

export const BOARD_LIMIT = 1000;

// Board view: no pagination; every matching active application (up to a safety cap) so cards can be dragged between columns.
export async function listForBoard(supabase: SupabaseClient, f: AppFilters) {
  const { data, count, error } = await applyFilters(supabase.from("applications").select("*", { count: "exact" }), { ...f, view: "active" })
    .order("updated_at", { ascending: false })
    .order("id")
    .range(0, BOARD_LIMIT - 1);
  if (error) throw new Error("applications_query_failed");
  return { rows: (data ?? []) as Application[], total: count ?? 0, page: 1, pageSize: BOARD_LIMIT };
}
