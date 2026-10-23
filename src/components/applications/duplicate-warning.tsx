"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApplicationDuplicate } from "@/lib/applications/types";
export function DuplicateWarning({
  candidate,
  serverMatches,
}: {
  candidate: { company_name: string; application_url: string; requisition_id: string; job_id?: string };
  serverMatches?: ApplicationDuplicate[];
}) {
  const [matches, setMatches] = useState<ApplicationDuplicate[]>([]);
  const signature = JSON.stringify(candidate);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      if (!candidate.application_url && !(candidate.company_name && candidate.requisition_id) && !candidate.job_id) {
        setMatches([]);
        return;
      }
      try {
        const response = await fetch("/api/applications/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: signature,
          signal: abort.signal,
        });
        if (response.ok) setMatches((await response.json()).duplicates);
      } catch {
        /* The save action also checks duplicates before writing. */
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [signature, candidate.application_url, candidate.company_name, candidate.requisition_id, candidate.job_id]);
  const duplicates = serverMatches?.length ? serverMatches : matches;
  return duplicates.length ? (
    <div className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm" role="status">
      <p className="font-medium">Possible existing application</p>
      <ul className="grid gap-2">
        {duplicates.map((match) => (
          <li key={match.id}>
            <Link href={`/applications/${match.id}`} target="_blank" className="underline">
              {match.company_name} · {match.role_title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {match.reason} · {match.status} · opens in a new tab
            </p>
          </li>
        ))}
      </ul>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="allow_duplicate" className="mt-1 size-4 accent-primary" /> Create a separate application anyway
      </label>
    </div>
  ) : null;
}
