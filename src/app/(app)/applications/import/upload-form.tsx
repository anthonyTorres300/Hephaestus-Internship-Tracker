"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, FormAlert, type FormState } from "@/components/forms/fields";
import { Textarea } from "@/components/ui/textarea";

export function ImportUploadForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);

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
        <input
          id="f-file"
          name="file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
        />
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
          {busy ? "Checking rows…" : "Preview import"}
        </Button>
      </div>
    </form>
  );
}
