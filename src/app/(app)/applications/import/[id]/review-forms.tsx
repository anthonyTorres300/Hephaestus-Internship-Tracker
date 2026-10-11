"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormAlert, NativeSelect, SubmitButton, type FormState } from "@/components/forms/fields";
import { STATUSES, STATUS_LABEL } from "@/lib/domain";
import { restageAction, saveDecisionsAction, undoBatchAction } from "../actions";

export function StatusMappingForm({
  batchId,
  labels,
}: {
  batchId: string;
  labels: { label: string; count: number; status: string | null; needsMapping: boolean }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(restageAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} />
      <input type="hidden" name="batch_id" value={batchId} />
      <ul className="grid gap-2">
        {labels.map((l) => (
          <li key={l.label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{l.label || "(blank)"}</span> <span className="text-muted-foreground">× {l.count}</span>
            </span>
            <NativeSelect
              name={`map:${l.label.toLowerCase()}`}
              defaultValue={l.status ?? ""}
              aria-label={`Status for “${l.label}”`}
              className="w-44"
            >
              <option value="">Not mapped</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        The original label is always kept. “Not Proceeding” defaults to Rejected; change it to Withdrawn if that is what it meant.
      </p>
      <div>
        <SubmitButton size="sm" pendingText="Re-checking…">
          Apply mappings
        </SubmitButton>
      </div>
    </form>
  );
}

export function RowsForm({ batchId, children }: { batchId: string; children: React.ReactNode }) {
  const [state, action] = useActionState<FormState, FormData>(saveDecisionsAction, {});
  const [fix, fixAction] = useActionState<FormState, FormData>(restageAction, {});
  return (
    <div className="grid gap-3">
      <FormAlert state={state} />
      <FormAlert state={fix} />
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="batch_id" value={batchId} />
        <Button type="submit" name="op" value="accept_clean" variant="outline" size="sm">
          Accept all rows with no issues
        </Button>
        <Button type="submit" name="op" value="skip_errors" variant="outline" size="sm">
          Skip all rows with errors
        </Button>
      </form>
      <form id="rows-form" action={action}>
        <input type="hidden" name="batch_id" value={batchId} />
        <input type="hidden" name="op" value="save" />
        {children}
        <div className="mt-3 flex flex-wrap gap-2">
          <SubmitButton size="sm" pendingText="Saving…">
            Save decisions on this page
          </SubmitButton>
          <Button type="submit" size="sm" variant="outline" formAction={fixAction}>
            Re-check with corrections
          </Button>
        </div>
      </form>
    </div>
  );
}

export function CommitPanel({ batchId, ready, pendingNote }: { batchId: string; ready: boolean; pendingNote: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<FormState>({});
  async function commit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/import/${batchId}/commit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
        return;
      }
      setMsg({ status: "error", message: body?.error?.message ?? "Could not commit." });
    } catch {
      setMsg({ status: "error", message: "Network error. Nothing was saved. Retrying is safe." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      <FormAlert state={msg} />
      <p className="text-sm">{pendingNote}</p>
      <p className="text-xs text-muted-foreground">
        By committing you confirm you actually submitted every application marked Applied or later. Existing applications are never
        overwritten.
      </p>
      <div>
        <Button onClick={commit} disabled={!ready || busy}>
          {busy ? "Committing…" : "Commit import"}
        </Button>
      </div>
    </div>
  );
}

export function UndoForm({ batchId }: { batchId: string }) {
  const [state, action] = useActionState<FormState, FormData>(undoBatchAction, {});
  return (
    <form action={action} className="grid gap-2">
      <FormAlert state={state} />
      <input type="hidden" name="batch_id" value={batchId} />
      <p className="text-xs text-muted-foreground">
        Undo moves only unchanged records from this import to trash. Anything you edited since, or linked, is kept for your review.
      </p>
      <div>
        <SubmitButton variant="outline" size="sm" pendingText="Undoing…">
          Undo this import
        </SubmitButton>
      </div>
    </form>
  );
}
