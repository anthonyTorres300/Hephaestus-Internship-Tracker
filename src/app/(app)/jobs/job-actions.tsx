"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { Bookmark, EyeOff, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";
import { toggleHideAction, toggleSaveAction } from "./actions";

async function send(kind: "save" | "hide", jobId: string, value: boolean) {
  const fd = new FormData();
  fd.set("job_id", jobId);
  fd.set("value", String(value));
  return await (kind === "save" ? toggleSaveAction(fd) : toggleHideAction(fd));
}

export function JobActions({
  jobId,
  saved,
  hidden,
  applyUrl,
  applicationId,
}: {
  jobId: string;
  saved: boolean;
  hidden: boolean;
  applyUrl: string | null;
  applicationId?: string | null;
}) {
  const toast = useToast();
  const [isSaved, setSaved] = useState(saved);
  const [isHidden, setHidden] = useState(hidden);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = useRef({ saved, hidden });

  async function toggle(kind: "save" | "hide", value?: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const before = current.current[kind === "save" ? "saved" : "hidden"];
    const next = value ?? !before;
    const update = kind === "save" ? setSaved : setHidden;
    current.current[kind === "save" ? "saved" : "hidden"] = next;
    update(next);
    try {
      const result = await send(kind, jobId, next);
      if (!result.ok) throw new Error(result.message);
      toast({
        message:
          kind === "save"
            ? next
              ? "Saved to your list."
              : "Removed from your saved list."
            : next
              ? "Hidden from your feed."
              : "Back in your feed.",
        actionLabel: "Undo",
        onAction: () => {
          void toggle(kind, before);
        },
      });
    } catch {
      current.current[kind === "save" ? "saved" : "hidden"] = before;
      update(before);
      toast({
        message: "Could not save the change. Check your connection and retry.",
        actionLabel: "Retry",
        onAction: () => {
          void toggle(kind, next);
        },
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" aria-busy={busy}>
      <Button
        type="button"
        size="sm"
        variant={isSaved ? "default" : "outline"}
        className="min-h-11 px-3"
        aria-pressed={isSaved}
        disabled={busy}
        onClick={() => void toggle("save")}
      >
        <Bookmark aria-hidden /> {isSaved ? "Saved" : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-11 px-3"
        aria-pressed={isHidden}
        disabled={busy}
        onClick={() => void toggle("hide")}
      >
        <EyeOff aria-hidden /> {isHidden ? "Unhide" : "Hide"}
      </Button>
      <Link
        href={applicationId ? `/applications/${applicationId}` : `/applications/new?job=${jobId}`}
        className={buttonVariants({ size: "sm", variant: "outline", className: "min-h-11 px-3" })}
      >
        <Plus aria-hidden /> {applicationId ? "View application" : "Log application"}
      </Link>
      {busy ? (
        <span role="status" className="col-span-2 text-xs text-muted-foreground">
          Saving…
        </span>
      ) : null}
      {applyUrl ? (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={buttonVariants({ size: "sm", className: "min-h-11 px-4" })}
        >
          Apply<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}
