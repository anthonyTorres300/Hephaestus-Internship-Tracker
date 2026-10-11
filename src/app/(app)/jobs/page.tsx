import Link from "next/link";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/auth/session";
import { loadFeed, type FeedFilters } from "@/lib/jobs/feed";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { AutoSubmitForm } from "@/components/forms/auto-submit-form";
import { Flame, Search, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchHot } from "@/lib/jobs/hot-companies";
import { Chip } from "./filter-chip";
import { CompanyPill } from "./company-pill";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/forms/fields";
import { ROLE_CATEGORIES } from "@/lib/domain";
import { JOB_PREFS_COOKIE, ROLE_GROUPS, parseJobPrefs, type RoleGroup } from "@/lib/jobs/prefs";
import { fmtInstant, seasonLabel } from "@/lib/ui/format";
import { JobRow } from "./job-ui";
import { saveJobPrefsAction } from "./actions";

export const metadata = { title: "Jobs" };
const PAGE = 25;

export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile, isAdmin } = await requireWorkspace();
  const sp = await searchParams;
  const now = new Date();

  // Saved defaults come from the cookie; a submitted search form (f=1) overrides them for that search.
  const saved = parseJobPrefs((await cookies()).get(JOB_PREFS_COOKIE)?.value);
  const submitted = sp.f === "1";
  const role: RoleGroup = submitted && sp.role && sp.role in ROLE_GROUPS ? (sp.role as RoleGroup) : saved.role;
  const undergradOnly = submitted ? sp.undergrad === "1" : saved.undergradOnly;

  const filters: FeedFilters = {
    q: sp.q,
    category: sp.category || undefined,
    role,
    undergradOnly,
    eligibility: (["eligible", "needs_review", "ineligible"] as const).find((e) => e === sp.eligibility),
    season: (["target", "unknown", "all"] as const).find((s) => s === sp.season) ?? "target",
    showHidden: sp.hidden === "1",
    showApplied: sp.applied === "1",
    showIneligible: sp.ineligible === "1",
    sort: (["first_seen", "posted", "relevance"] as const).find((s) => s === sp.sort) ?? "first_seen",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [feedBase, health] = await Promise.all([
    loadFeed(supabase, profile, filters, now),
    supabase.from("feed_health").select("repository, last_success_at, stale"),
  ]);
  // "Top companies": counts come from the list BEFORE a company filter, so the strip stays useful while one is selected.
  const hotCounts = new Map<string, { n: number; applyUrl: string | null }>();
  for (const i of feedBase) {
    const hot = matchHot(i.job.company);
    if (hot) hotCounts.set(hot, { n: (hotCounts.get(hot)?.n ?? 0) + 1, applyUrl: hotCounts.get(hot)?.applyUrl ?? i.job.apply_url });
  }
  const hotStrip = [...hotCounts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 16);
  const company = sp.company && hotCounts.has(sp.company) ? sp.company : undefined;
  const hotOnly = sp.hot === "1";
  const feedAll = company
    ? feedBase.filter((i) => matchHot(i.job.company) === company)
    : hotOnly
      ? feedBase.filter((i) => matchHot(i.job.company))
      : feedBase;
  const tab = sp.tab === "new" || sp.tab === "saved" ? sp.tab : "all";
  const isNew = (i: (typeof feedAll)[number]) => now.getTime() - new Date(i.job.first_seen_at).getTime() <= 48 * 3600_000;
  const newItems = feedAll.filter(isNew);
  const savedItems = feedAll.filter((i) => i.userJob?.saved);
  const items = tab === "new" ? newItems : tab === "saved" ? savedItems : feedAll;
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const slice = items.slice((page - 1) * PAGE, page * PAGE);
  const sources = health.data ?? [];
  const lastOk = sources
    .map((s) => s.last_success_at)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;
  const autoConfigured = !!process.env.DISCOVERY_DATABASE_URL;
  const anyStale = sources.length === 0 || sources.some((s) => s.stale);
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    return `/jobs?${p.toString()}`;
  };
  const advancedCount = [
    sp.category,
    sp.eligibility,
    sp.hidden,
    sp.applied,
    sp.ineligible,
    sp.season && sp.season !== "target" ? "x" : "",
  ].filter(Boolean).length;
  const roleLabels: Record<RoleGroup, string> = { swe: "Software", data_ai: "Data & AI", tech: "Any tech", all: "All" };

  return (
    <>
      <PageHeader
        title="Jobs"
        description={lastOk ? `${sources.length} sources · refreshed ${fmtInstant(lastOk, profile.timezone)}` : "No refresh yet"}
        actions={<AutoRefresh stale={false} configured={autoConfigured} showButton />}
      />

      {anyStale ? (
        <p role="status" className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {sources.length === 0
            ? "No discovery sources are configured yet."
            : lastOk
              ? "The list is more than 48 hours old."
              : autoConfigured
                ? "Nothing loaded yet. Fetching listings now; this page updates when it finishes."
                : isAdmin
                  ? "Nothing loaded yet. Run npm run discovery once."
                  : "Nothing loaded yet. Ask the site administrator to run discovery."}{" "}
          {isAdmin ? (
            <Link className="underline" href="/admin/sources">
              Admin
            </Link>
          ) : null}
        </p>
      ) : null}

      <AutoSubmitForm method="get" role="search" className="mb-5 grid gap-3">
        <input type="hidden" name="f" value="1" />
        {company ? <input type="hidden" name="company" value={company} /> : null}
        <input id="jobs-filters-toggle" type="checkbox" className="peer sr-only" defaultChecked={advancedCount > 0} />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            type="search"
            defaultValue={sp.q}
            placeholder="Search company, role or location"
            aria-label="Search listings"
            className="h-14 rounded-full bg-card pr-28 pl-14 text-lg ring-1 ring-white/10 [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd
            className="pointer-events-none absolute top-1/2 right-28 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[11px] text-muted-foreground sm:block"
            aria-hidden
          >
            /
          </kbd>
          <Button type="submit" className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-full px-6 text-base">
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Role type" className="inline-flex gap-1 rounded-full bg-white/5 p-1">
            {(Object.keys(ROLE_GROUPS) as RoleGroup[]).map((k) => (
              <Chip key={k} type="radio" name="role" value={k} checked={role === k} className="h-8 px-3.5 ring-0">
                {roleLabels[k]}
              </Chip>
            ))}
          </div>
          <Chip type="checkbox" name="undergrad" value="1" checked={undergradOnly}>
            Undergrad-friendly
          </Chip>
          <Chip type="checkbox" name="hot" value="1" checked={hotOnly && !company}>
            <Flame className="size-4" aria-hidden /> Top companies
          </Chip>
          <label
            htmlFor="jobs-filters-toggle"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm text-muted-foreground ring-1 ring-white/10 transition-colors hover:text-foreground peer-checked:bg-white/10 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Filters
            {advancedCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{advancedCount}</span>
            ) : null}
          </label>
          <NativeSelect name="sort" defaultValue={filters.sort} aria-label="Sort by" className="ml-auto h-9 w-36 rounded-full">
            <option value="first_seen">Newest first</option>
            <option value="posted">Listing date</option>
          </NativeSelect>
        </div>

        <div className="hidden gap-4 rounded-lg bg-card p-4 ring-1 ring-white/10 peer-checked:grid">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Season
              <NativeSelect name="season" defaultValue={filters.season}>
                <option value="target">{seasonLabel(profile.target_season, profile.target_year)}</option>
                <option value="unknown">Season unknown</option>
                <option value="all">All seasons</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Exact category
              <NativeSelect name="category" defaultValue={sp.category ?? ""}>
                <option value="">Any</option>
                {ROLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Eligibility
              <NativeSelect name="eligibility" defaultValue={sp.eligibility ?? ""}>
                <option value="">Hide explicit mismatches</option>
                <option value="eligible">Matches recorded requirements</option>
                <option value="needs_review">Needs review</option>
                <option value="ineligible">Explicit mismatch</option>
              </NativeSelect>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip type="checkbox" name="hidden" value="1" checked={filters.showHidden ?? false} className="h-9">
              Show hidden
            </Chip>
            <Chip type="checkbox" name="applied" value="1" checked={filters.showApplied ?? false} className="h-9">
              Show applied
            </Chip>
            <Chip type="checkbox" name="ineligible" value="1" checked={filters.showIneligible ?? false} className="h-9">
              Show mismatches
            </Chip>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <Link href="/jobs" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Reset
              </Link>
              <Button type="submit" formAction={saveJobPrefsAction} variant="link" size="sm" className="h-auto px-0 text-xs">
                Save role and undergrad as my default
              </Button>
            </span>
          </div>
        </div>
      </AutoSubmitForm>

      {hotStrip.length > 0 ? (
        <nav aria-label="Top companies" className="mb-5 -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            {hotStrip.map(([name, info]) => {
              const active = company === name;
              return (
                <li key={name}>
                  <CompanyPill
                    name={name}
                    count={info.n}
                    active={active}
                    href={link({ company: active ? undefined : name, hot: undefined, page: undefined, f: "1" })}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Listing views" className="flex gap-1 rounded-full bg-white/5 p-1">
          {(
            [
              ["all", "All", feedAll.length],
              ["new", "New", newItems.length],
              ["saved", "Saved", savedItems.length],
            ] as const
          ).map(([key, label, n]) => (
            <Link
              key={key}
              href={link({ tab: key === "all" ? undefined : key, page: undefined })}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                tab === key && "bg-primary/15 text-primary hover:text-primary",
              )}
            >
              {label} <span className="text-xs tabular-nums opacity-80">{n}</span>
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {company ? (
            <>
              {company} ·{" "}
              <Link className="underline underline-offset-2" href={link({ company: undefined, page: undefined })}>
                clear
              </Link>{" "}
              ·{" "}
            </>
          ) : null}
          {items.length} listing{items.length === 1 ? "" : "s"}
          {pages > 1 ? ` · page ${page} of ${pages}` : ""}
        </p>
      </div>

      {slice.length === 0 ? (
        <EmptyState title="No listings match these filters">
          {sources.length === 0
            ? "Discovery sources are not configured yet. You can still add applications by hand."
            : "Try turning off Undergrad-friendly, widening the role type, or choosing All seasons under Filters."}
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-2">
            {slice.map((it) => (
              <JobRow key={it.job.id} item={it} tz={profile.timezone} now={now} />
            ))}
          </ul>
          <nav aria-label="Pagination" className="mt-4 flex justify-between">
            {page > 1 ? (
              <Link className={buttonVariants({ variant: "outline" })} href={link({ page: String(page - 1) })}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            {page < pages ? (
              <Link className={buttonVariants({ variant: "outline" })} href={link({ page: String(page + 1) })}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </>
  );
}
