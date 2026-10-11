import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { listApplications, listForBoard, parseFilters, seasonCounts, PAGE_SIZE } from "@/lib/data/applications";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/forms/fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { STATUSES, STATUS_LABEL } from "@/lib/domain";
import { seasonLabel, submissionLabel } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { MoreMenu } from "@/components/layout/more-menu";

export const metadata = { title: "Applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireWorkspace();
  const sp = await searchParams;
  const f = parseFilters(sp, profile.target_year);
  const board = (Array.isArray(sp.layout) ? sp.layout[0] : sp.layout) === "board" && f.view === "active";
  const [{ rows, total, page }, counts] = await Promise.all([
    board ? listForBoard(supabase, f) : listApplications(supabase, f),
    seasonCounts(supabase, profile.target_year),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      view: f.view === "active" ? undefined : f.view,
      layout: board ? "board" : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `/applications?${p.toString()}`;
  };

  const seasonTabs = [
    {
      value: String(profile.target_year),
      label: `${profile.target_season[0].toUpperCase()}${profile.target_season.slice(1)} ${profile.target_year}`,
      n: counts.current,
    },
    { value: "unclassified", label: "Unclassified season", n: counts.unclassified },
    { value: "all", label: "All history", n: counts.all },
  ];

  return (
    <>
      <PageHeader
        title="Applications"
        description="Your private application log."
        actions={
          <>
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
        {seasonTabs.map((t) => (
          <Link
            key={t.value}
            href={qs({ season: t.value, page: undefined })}
            aria-current={f.season === t.value ? "page" : undefined}
            className={cn(buttonVariants({ variant: f.season === t.value ? "default" : "outline", size: "sm" }))}
          >
            {t.label} ({t.n})
          </Link>
        ))}
        <span className="ml-auto flex gap-1 rounded-md bg-white/5 p-1" role="group" aria-label="Layout">
          {(["list", "board"] as const).map((l) => (
            <Link
              key={l}
              href={qs({ layout: l === "board" ? "board" : undefined, view: undefined, page: undefined })}
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

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-lg bg-card p-4 ring-1 ring-white/10"
        role="search"
        aria-label="Filter applications"
      >
        <input type="hidden" name="season" value={f.season} />
        {f.view !== "active" ? <input type="hidden" name="view" value={f.view} /> : null}
        {board ? <input type="hidden" name="layout" value="board" /> : null}
        <div className="flex flex-wrap gap-2">
          <Input
            name="q"
            defaultValue={f.q}
            placeholder="Search company or title   ( / )"
            aria-label="Search company or title"
            className="h-10 min-w-48 flex-1"
          />
          <NativeSelect name="status" defaultValue={f.status ?? ""} aria-label="Status" className="h-10 w-44">
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" className="h-10 px-5">
            Search
          </Button>
        </div>
        <details open={Boolean(f.priority || f.location || f.from || f.to)} className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">More filters and sorting</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              <Input name="location" defaultValue={f.location} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Submitted from
              <Input name="from" type="month" defaultValue={f.from} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Submitted to
              <Input name="to" type="month" defaultValue={f.to} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Sort by
              <NativeSelect name="sort" defaultValue={f.sort}>
                <option value="updated_at">Last updated</option>
                <option value="created_at">Created</option>
                <option value="company_name">Company</option>
                <option value="submitted_key">Submission date</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Order
              <NativeSelect name="dir" defaultValue={f.dir}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </NativeSelect>
            </label>
          </div>
          <div className="mt-3">
            <Link href="/applications" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Reset filters
            </Link>
          </div>
        </details>
      </form>

      {board && rows.length > 0 ? (
        <KanbanBoard
          key={JSON.stringify(sp)}
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
          title={total === 0 && counts.all === 0 ? "No applications yet" : "No applications match these filters"}
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <Link href="/applications/new" className={buttonVariants()}>
                Add your first application
              </Link>
              <Link href="/applications/import" className={buttonVariants({ variant: "outline" })}>
                Import from CSV
              </Link>
            </span>
          }
        >
          {counts.all === 0
            ? "Add one manually, or import your existing log from a CSV."
            : f.season !== "all"
              ? "Try “All history” or clear filters."
              : "Clear a filter to see more."}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
          </p>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Season</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id} className="relative cursor-pointer">
                        <TableCell className="font-medium">
                          <Link
                            className="underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                            href={`/applications/${a.id}`}
                          >
                            {a.company_name}
                          </Link>
                        </TableCell>
                        <TableCell>{a.role_title}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell>{submissionLabel(a)}</TableCell>
                        <TableCell className="capitalize">{a.priority}</TableCell>
                        <TableCell>{a.season_year ? seasonLabel(a.season, a.season_year) : "Unclassified"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <ul className="grid gap-3 md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/applications/${a.id}`}
                  className="grid gap-1 rounded-md border p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{a.company_name}</span>
                  <span className="text-sm">{a.role_title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={a.status} /> {submissionLabel(a)} · <span className="capitalize">{a.priority}</span> priority
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
