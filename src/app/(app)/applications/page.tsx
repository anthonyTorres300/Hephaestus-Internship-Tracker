import { APP_VIEW_COOKIE, parseAppView } from "@/lib/applications/prefs";
import { cookies } from "next/headers";
import { BrowseContext } from "@/components/layout/browse-context";
import { ViewPreferences } from "./view-preferences";
import { localDateIn } from "@/lib/domain/dates";
import { RefreshButton } from "@/components/layout/refresh-button";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import { listApplications, listForBoard, parseFilters, PAGE_SIZE, PAGE_SIZES } from "@/lib/data/applications";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL } from "@/lib/domain";
import { seasonLabel, submissionLabel } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { ApplicationsList } from "./applications-list";
import { loadSeasons, seasonKey } from "@/lib/data/seasons";
import { SeasonTabs } from "./season-tabs";
import { AutoSubmitForm } from "@/components/forms/auto-submit-form";
import { MoreMenu } from "@/components/layout/more-menu";

export const metadata = { title: "Applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireWorkspace();
  const query = await searchParams;
  const prefs = parseAppView((await cookies()).get(APP_VIEW_COOKIE)?.value);
  const sp = { ...query, layout: query.layout ?? prefs.layout, per: query.per ?? (prefs.per ? String(prefs.per) : undefined) };
  const f = parseFilters(sp, seasonKey(profile.target_season, profile.target_year));
  const board = (Array.isArray(sp.layout) ? sp.layout[0] : sp.layout) === "board" && f.view === "active";
  const [{ rows, total, page }, seasons] = await Promise.all([
    board ? listForBoard(supabase, f) : listApplications(supabase, f),
    loadSeasons(supabase, { season: profile.target_season, year: profile.target_year }),
  ]);
  const pages = Math.max(1, Math.ceil(total / (f.per ?? PAGE_SIZE)));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | undefined> = {
      q: f.q,
      status: f.status,
      season: f.season,
      location: f.location,
      priority: f.priority,
      from: f.from,
      to: f.to,
      sort: f.sort,
      dir: f.dir,
      per: f.per === PAGE_SIZE ? undefined : String(f.per),
      view: f.view === "active" ? undefined : f.view,
      layout: board ? "board" : "list",
      ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `/applications?${p.toString()}`;
  };

  // Clicking the active sort flips its direction; a new sort starts high-priority/earliest-stage first, or newest first for dates.
  const sortOptions = [
    { key: "company_name", label: "Company", first: "asc" },
    { key: "status", label: "Status", first: "asc" },
    { key: "submitted_key", label: "Date submitted", first: "desc" },
    { key: "priority", label: "Priority", first: "asc" },
  ] as const;
  const sortHref = (key: string, first: "asc" | "desc") =>
    qs({ sort: key, dir: f.sort === key ? (f.dir === "asc" ? "desc" : "asc") : first, page: undefined });

  const targetKey = seasonKey(profile.target_season, profile.target_year);
  const tabItems = [
    ...seasons.tabs.map((t) => ({
      key: t.key,
      label: t.label,
      n: t.n,
      href: qs({ season: t.key, page: undefined }),
      remove: t.removable ? { name: t.name, year: t.year } : undefined,
    })),
    { key: "unclassified", label: "Unclassified", n: seasons.unclassified, href: qs({ season: "unclassified", page: undefined }) },
    { key: "all", label: "All history", n: seasons.all, href: qs({ season: "all", page: undefined }) },
  ];
  const advancedCount = [f.priority, f.location, f.from, f.to].filter(Boolean).length;

  return (
    <>
      <BrowseContext section="applications" />
      <ViewPreferences layout={board ? "board" : "list"} per={f.per ?? PAGE_SIZE} />
      <PageHeader
        title="Applications"
        description="Your private application log."
        actions={
          <>
            <RefreshButton />
            <Link href="/applications/new" className={buttonVariants()}>
              New application
            </Link>
            <MoreMenu>
              <Link href="/applications/import" role="menuitem">
                Import from CSV
              </Link>
              <a href="/api/export?format=csv" role="menuitem">
                Export CSV
              </a>
              <Link href={qs({ view: "archived", layout: undefined, page: undefined })} role="menuitem">
                Archived
              </Link>
              <Link href={qs({ view: "trash", layout: undefined, page: undefined })} role="menuitem">
                Trash
              </Link>
            </MoreMenu>
          </>
        }
      />

      <nav aria-label="Season view" className="mb-4 flex flex-wrap gap-2">
        <div className="flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap">
          <SeasonTabs
            items={tabItems}
            current={f.season ?? targetKey}
            newHref={qs({ season: "__SEASON__", page: undefined })}
            fallbackHref={qs({ season: targetKey, page: undefined })}
            defaultYear={profile.target_year}
          />
        </div>
        <span className="ml-auto flex gap-1 rounded-md bg-white/5 p-1" role="group" aria-label="Layout">
          {(["list", "board"] as const).map((l) => (
            <Link
              key={l}
              href={qs({ layout: l, view: undefined, page: undefined })}
              aria-current={(l === "board") === board ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold capitalize text-muted-foreground transition-colors hover:text-foreground",
                (l === "board") === board && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              {l}
            </Link>
          ))}
        </span>
      </nav>

      {f.view !== "active" ? (
        <p role="status" className="mb-4 flex items-center justify-between rounded-md bg-white/5 p-3 text-sm">
          <span>Viewing {f.view === "archived" ? "archived" : "trashed"} applications.</span>
          <Link href={qs({ view: undefined, page: undefined })} className="underline underline-offset-2">
            Back to active
          </Link>
        </p>
      ) : null}

      <AutoSubmitForm method="get" role="search" aria-label="Filter applications" className="mb-5 grid gap-3">
        <input type="hidden" name="season" value={f.season} />
        <input type="hidden" name="sort" value={f.sort} />
        <input type="hidden" name="dir" value={f.dir} />
        {f.per !== PAGE_SIZE ? <input type="hidden" name="per" value={f.per} /> : null}
        {f.view !== "active" ? <input type="hidden" name="view" value={f.view} /> : null}
        {board ? <input type="hidden" name="layout" value="board" /> : null}
        <input id="apps-filters-toggle" type="checkbox" className="peer sr-only" defaultChecked={advancedCount > 0} />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            type="search"
            defaultValue={f.q}
            placeholder="Search company or role"
            aria-label="Search applications"
            className="h-14 rounded-full bg-card pr-28 pl-14 text-lg ring-1 ring-white/10 [&::-webkit-search-cancel-button]:hidden"
          />
          <Button type="submit" className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-full px-6 text-base">
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect name="status" defaultValue={f.status ?? ""} aria-label="Status" className="h-9 w-40 rounded-full">
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <label
            htmlFor="apps-filters-toggle"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm text-muted-foreground ring-1 ring-white/10 transition-colors hover:text-foreground peer-checked:bg-white/10 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Filters
            {advancedCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{advancedCount}</span>
            ) : null}
          </label>
          {f.q || f.status || advancedCount > 0 ? (
            <Link
              href={qs({
                q: undefined,
                status: undefined,
                priority: undefined,
                location: undefined,
                from: undefined,
                to: undefined,
                page: undefined,
              })}
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear all
            </Link>
          ) : null}
        </div>

        <div className="hidden gap-3 rounded-lg bg-card p-4 ring-1 ring-white/10 peer-checked:grid sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Priority
            <NativeSelect name="priority" defaultValue={f.priority ?? ""}>
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Location
            <Input name="location" defaultValue={f.location} placeholder="Any" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Submitted from
            <Input name="from" type="month" defaultValue={f.from} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Submitted to
            <Input name="to" type="month" defaultValue={f.to} />
          </label>
        </div>
      </AutoSubmitForm>

      {board && rows.length > 0 ? (
        <KanbanBoard
          key={JSON.stringify([sp, rows.map((r) => [r.id, r.revision])])}
          apps={rows.map((a) => ({
            id: a.id,
            revision: a.revision,
            status: a.status,
            company_name: a.company_name,
            role_title: a.role_title,
            priority: a.priority,
            sub: submissionLabel(a),
          }))}
          truncated={total > rows.length}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={total === 0 && seasons.all === 0 ? "No applications yet" : "No applications match these filters"}
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <RefreshButton />
              <Link href="/applications/new" className={buttonVariants()}>
                Add your first application
              </Link>
              <Link href="/applications/import" className={buttonVariants({ variant: "outline" })}>
                Import from CSV
              </Link>
            </span>
          }
        >
          {seasons.all === 0
            ? "Add one manually, or import your existing log from a CSV."
            : f.season !== "all"
              ? "Try “All history” or clear filters."
              : "Clear a filter to see more."}
        </EmptyState>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p aria-live="polite">
              {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
            </p>
            <nav aria-label="Rows per page" className="flex items-center gap-1">
              Show
              {PAGE_SIZES.map((n) => (
                <Link
                  key={n}
                  href={qs({ per: String(n), page: undefined })}
                  aria-current={f.per === n ? "true" : undefined}
                  className={buttonVariants({ variant: f.per === n ? "default" : "outline", size: "xs" })}
                >
                  {n}
                </Link>
              ))}
            </nav>
          </div>
          <ApplicationsList
            key={JSON.stringify(sp)}
            today={localDateIn(new Date(), profile.timezone)}
            canBulk={f.view === "active"}
            sort={f.sort ?? "updated_at"}
            dir={f.dir ?? "desc"}
            sortHrefs={Object.fromEntries(sortOptions.map((o) => [o.key, sortHref(o.key, o.first)]))}
            seasons={seasons.tabs.map((t) => ({ key: t.key, label: t.label }))}
            apps={rows.map((a) => ({
              id: a.id,
              revision: a.revision,
              portal: a.portal_url,
              status: a.status,
              company_name: a.company_name,
              url: a.application_url ?? a.portal_url,
              role_title: a.role_title,
              priority: a.priority,
              sub: submissionLabel(a),
              seasonText: a.season_year ? seasonLabel(a.season, a.season_year) : "Unclassified",
            }))}
          />
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
            {page > 1 ? (
              <Link className={buttonVariants({ variant: "outline" })} href={qs({ page: String(page - 1) })}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            {page < pages ? (
              <Link className={buttonVariants({ variant: "outline" })} href={qs({ page: String(page + 1) })}>
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
