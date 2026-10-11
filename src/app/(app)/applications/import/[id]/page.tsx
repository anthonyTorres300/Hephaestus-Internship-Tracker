import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/fields";
import { TWO_DIGIT_YEAR_RULE, collectStatusLabels, mapStatus } from "@/lib/import";
import type { BatchRow, BatchSummary } from "@/lib/data/import";
import { cancelBatchAction } from "../actions";
import { CommitPanel, RowsForm, StatusMappingForm, UndoForm } from "./review-forms";

export const metadata = { title: "Review import" };
const PAGE = 50;

export default async function ReviewImport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; only?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const { supabase } = await requireWorkspace();
  const { data: batch } = await supabase.from("import_batches").select("*").eq("id", id).maybeSingle();
  if (!batch) notFound();
  const summary = batch.summary as BatchSummary;
  const page = Math.max(1, Number(sp.page) || 1);

  const { data: all } = await supabase
    .from("import_rows")
    .select("id, ordinal, raw_values, proposed, warnings, errors, decision, outcome, application_id, linked_application_id")
    .eq("batch_id", id)
    .order("ordinal")
    .limit(5000);
  const rows = (all ?? []) as BatchRow[];
  const live = rows.filter((r) => r.decision !== "skip");
  const withErrors = live.filter((r) => r.errors.length).length;
  const blocking = live.filter((r) => r.decision === "pending" && r.warnings.some((w) => w.blocking)).length;
  const ready = batch.state === "staged" && withErrors === 0 && blocking === 0;
  const shown = sp.only === "issues" ? rows.filter((r) => r.errors.length || r.warnings.length) : rows;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pageRows = shown.slice((page - 1) * PAGE, page * PAGE);

  const statusIdx = summary.columnMap.status ?? summary.columnMap.original_status ?? null;
  const cellsForLabels = rows.map((r) => {
    const names = summary.headers.map((h, i, arr) => (arr.indexOf(h) === i ? h : `${h}#${i + 1}`));
    return names.map((n) => String(r.raw_values[n] ?? ""));
  });
  const labels = collectStatusLabels({ rows: cellsForLabels }, statusIdx, summary.statusMap).map((l) => ({
    label: l.label,
    count: l.count,
    status: l.status ?? mapStatus(l.label, summary.statusMap).status ?? null,
    needsMapping: l.needsMapping,
  }));
  const editable = batch.state === "staged";
  const dateOfRow = (r: BatchRow) => {
    const p = r.proposed;
    return p.submitted_precision === "day"
      ? `${p.submitted_year}-${String(p.submitted_month).padStart(2, "0")}-${String(p.submitted_day).padStart(2, "0")}`
      : p.submitted_precision === "month"
        ? `${p.submitted_year}-${String(p.submitted_month).padStart(2, "0")} (month only)`
        : p.submission_date_unknown
          ? "unknown"
          : "—";
  };
  const q = (over: Record<string, string>) =>
    `/applications/import/${id}?${new URLSearchParams({ ...(sp.only ? { only: sp.only } : {}), ...over })}`;

  return (
    <>
      <PageHeader
        title={batch.file_name ?? "Pasted rows"}
        description={`${rows.length} non-blank rows · ${batch.state}`}
        actions={
          <Link href="/applications/import" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            All imports
          </Link>
        }
      />

      {batch.state === "committed" || batch.state === "undone" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Created + linked + skipped + failed = {summary.total ?? rows.length} non-blank input rows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(
                [
                  ["Created", summary.created],
                  ["Linked", summary.linked],
                  ["Skipped", summary.skipped],
                  ["Failed", summary.failed],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-2xl font-semibold">{v ?? 0}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/import/${id}/errors`}>
                Download report (CSV)
              </a>
              <Link href="/applications?season=all" className={buttonVariants({ variant: "outline", size: "sm" })}>
                View applications
              </Link>
            </div>
            {batch.state === "committed" ? (
              <UndoForm batchId={id} />
            ) : (
              <p className="text-sm">
                Undone: {summary.undo_trashed ?? 0} moved to trash, {summary.undo_kept_for_review ?? 0} kept for your review.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {editable ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>2. Confirm status mapping</CardTitle>
              <CardDescription>Every distinct status label in your file and how it will be imported.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusMappingForm batchId={id} labels={labels} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>4. Commit</CardTitle>
              <CardDescription>
                {rows.length} rows · {withErrors} with errors · {blocking} need a decision · {rows.length - live.length} skipped
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CommitPanel
                batchId={id}
                ready={ready}
                pendingNote={
                  ready
                    ? "Every row is valid or skipped. You can commit."
                    : "Fix or skip every row with an error, and decide on flagged possible duplicates, to enable commit."
                }
              />
              <form action={cancelBatchAction}>
                <input type="hidden" name="batch_id" value={id} />
                <Button type="submit" variant="ghost" size="sm">
                  Cancel this import
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>3. Review rows</CardTitle>
          <CardDescription>
            Original values are always preserved. {TWO_DIGIT_YEAR_RULE} Ambiguous or suspicious dates are never auto-corrected: type the
            correct value in the box and re-check. Rows that look like duplicates are kept as separate rows until you decide.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex gap-2 text-sm">
            <Link className="underline" href={q({ only: "" })}>
              All rows
            </Link>{" "}
            ·{" "}
            <Link className="underline" href={q({ only: "issues" })}>
              Only rows with issues
            </Link>
          </div>
          {editable ? (
            <RowsForm batchId={id}>
              <RowList rows={pageRows} dateOf={dateOfRow} editable />
            </RowsForm>
          ) : (
            <RowList rows={pageRows} dateOf={dateOfRow} editable={false} />
          )}
          <nav aria-label="Pagination" className="flex justify-between text-sm">
            {page > 1 ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={q({ page: String(page - 1) })}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={q({ page: String(page + 1) })}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </CardContent>
      </Card>
    </>
  );
}

function RowList({ rows, dateOf, editable }: { rows: BatchRow[]; dateOf: (r: BatchRow) => string; editable: boolean }) {
  return (
    <ul className="grid gap-2">
      {rows.map((r) => {
        const needsDateFix = r.errors.some((e) => e.field === "application_date");
        return (
          <li key={r.id} className="grid gap-1.5 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-muted-foreground">#{r.ordinal}</span>{" "}
                <span className="font-medium">{r.proposed.company_name || "(no company)"}</span> — {r.proposed.role_title || "(no role)"}
              </span>
              <span className="flex items-center gap-1.5">
                {r.errors.length ? <Badge variant="destructive">Error</Badge> : null}
                {r.warnings.length ? <Badge variant="outline">Check</Badge> : null}
                {r.outcome ? <Badge className="capitalize">{r.outcome}</Badge> : null}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Status: {String(r.raw_values["Status"] ?? r.proposed.original_status ?? "—")} → {r.proposed.status ?? "unmapped"} · Date: “
              {r.proposed.original_application_date ?? ""}” → {dateOf(r)}
            </p>
            {[...r.errors, ...r.warnings].map((i, n) => (
              <p key={n} className={`text-xs ${r.errors.includes(i) ? "text-destructive" : "text-amber-800 dark:text-amber-300"}`}>
                {i.message}
              </p>
            ))}
            {editable ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-0.5 text-xs">
                  Decision
                  <NativeSelect name={`d:${r.ordinal}`} defaultValue={r.decision} className="w-36">
                    <option value="pending">Decide later</option>
                    <option value="accept">Import</option>
                    <option value="skip">Skip</option>
                  </NativeSelect>
                </label>
                {needsDateFix ? (
                  <label className="grid gap-0.5 text-xs">
                    Correct date text
                    <Input name={`ov:${r.ordinal}:application_date`} placeholder="e.g. Aug 26 2025" className="w-44" />
                  </label>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
