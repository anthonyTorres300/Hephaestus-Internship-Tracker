"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FormAlert, type FormState } from "@/components/forms/fields";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ImportUploadForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    fileRef.current.files = dt.files;
    setFileName(
      `${f.name} (${f.size < 1024 * 1024 ? Math.max(1, Math.round(f.size / 1024)) + " KB" : (f.size / 1024 / 1024).toFixed(1) + " MB"})`,
    );
    setState({});
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = fd.get("file");
    if (f instanceof File && f.size > 5 * 1024 * 1024) {
      setState({ status: "error", message: "The file is larger than 5 MB." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/applications/import/${body.batch_id}`);
        return;
      }
      setState({ status: "error", message: body?.error?.message ?? "Could not stage the import." });
    } catch {
      setState({ status: "error", message: "Network error. Nothing was imported." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormAlert state={state} />
      <Field label="CSV or TSV file (UTF-8, up to 5 MB / 5,000 rows)" name="file">
        <label
          htmlFor="f-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/60 focus-within:ring-3 focus-within:ring-ring/50",
            dragging && "border-primary bg-primary/10",
          )}
        >
          <UploadCloud className="size-6" aria-hidden />
          <span className="font-medium text-foreground">{fileName ?? "Drop a file here, or click to browse"}</span>
          <span className="text-xs">Your original values are always kept. Nothing is imported until you commit.</span>
          <input
            ref={fileRef}
            id="f-file"
            name="file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(e) => pick(e.target.files)}
          />
        </label>
      </Field>
      <Field label="…or paste table rows (tab-separated, including the header row)" name="pasted">
        <Textarea
          id="f-pasted"
          name="pasted"
          rows={5}
          className="font-mono text-xs"
          placeholder={"Company Name\tPosition Applied For\tApplication Date\tStatus"}
        />
      </Field>
      <CheckboxField
        name="new_review"
        label="Start a new review of a file I already imported"
        hint="By default, re-uploading the same file reopens its existing review instead of duplicating rows."
      />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Checking rows…
            </>
          ) : (
            "Preview import"
          )}
        </Button>
      </div>
    </form>
  );
}
