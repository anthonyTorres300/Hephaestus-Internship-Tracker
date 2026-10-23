"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { JobSuggestion } from "@/lib/applications/types";
export function JobLinkPrefill({ url, onAccept }: { url: string; onAccept: (suggestion: JobSuggestion) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; suggestion: JobSuggestion } | null>(null);
  const [message, setMessage] = useState("");
  async function suggest() {
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      const response = await fetch("/api/applications/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not read this job page.");
      setPreview({ url, suggestion: result.suggestion });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this job page. Enter details manually.");
    } finally {
      setBusy(false);
    }
  }
  const suggestion = preview?.url === url ? preview.suggestion : null;
  return (
    <div className="grid gap-2">
      <div>
        <Button type="button" variant="outline" size="sm" disabled={!url || busy} onClick={() => void suggest()}>
          {busy ? "Reading job page…" : "Suggest details from link"}
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
      {suggestion ? (
        <div className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <h3 className="font-medium">Review suggestions</h3>
          <dl className="grid gap-1">
            {Object.entries({
              Company: suggestion.company_name,
              Role: suggestion.role_title,
              Location: suggestion.locations?.join(", "),
              "Requisition ID": suggestion.requisition_id,
            })
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="inline text-muted-foreground">{label}: </dt>
                  <dd className="inline break-words">{value}</dd>
                </div>
              ))}
          </dl>
          <p className="text-xs text-muted-foreground">These come from the posting. Review them and edit anything inaccurate.</p>
          <div>
            <Button type="button" size="sm" onClick={() => onAccept(suggestion)}>
              Use these suggestions
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
