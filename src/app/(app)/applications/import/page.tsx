import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInstant } from "@/lib/ui/format";
import { ORIGINAL_HEADERS } from "@/lib/import";
import { ImportUploadForm } from "./upload-form";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const { supabase, profile } = await requireWorkspace();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, file_name, state, summary, created_at, committed_at")
    .order("created_at", { ascending: false })
    .limit(25);
  return (
    <>
      <PageHeader
        title="Import applications"
        description="Bring in an existing table. You review every row before anything is saved, and nothing is changed silently."
        actions={
          <>
            <a href="/api/import/template" className={buttonVariants({ variant: "outline" })}>
              Download template
            </a>
            <Link href="/applications" className={buttonVariants({ variant: "ghost" })}>
              Back to applications
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>1. Upload</CardTitle>
            <CardDescription>
              Export your table to CSV (or paste cells from a spreadsheet). Expected columns: {ORIGINAL_HEADERS.join(", ")}. Native Google
              Doc import is not available yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportUploadForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Past imports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(batches ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              (batches ?? []).map((b) => {
                const s = b.summary as { nonblank?: number; created?: number; skipped?: number; linked?: number; failed?: number };
                return (
                  <Link
                    key={b.id}
                    href={`/applications/import/${b.id}`}
                    className="grid gap-0.5 rounded-lg border p-3 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-medium">{b.file_name ?? "Pasted rows"}</span>
                      <Badge variant="outline" className="capitalize">
                        {b.state}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtInstant(b.created_at, profile.timezone)} · {s.nonblank ?? "?"} rows
                      {b.state === "committed"
                        ? ` · ${s.created ?? 0} created, ${s.skipped ?? 0} skipped, ${s.linked ?? 0} linked, ${s.failed ?? 0} failed`
                        : ""}
                    </span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
