"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, EyeOff, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";
import { toggleHideAction, toggleSaveAction } from "./actions";

async function send(kind: "save" | "hide", jobId: string, value: boolean) {
  const fd = new FormData();
  fd.set("job_id", jobId);
  fd.set("value", String(value));
  await (kind === "save" ? toggleSaveAction(fd) : toggleHideAction(fd));
}

export function JobActions({
  jobId,
  saved,
  hidden,
  applyUrl,
}: {
  jobId: string;
  saved: boolean;
  hidden: boolean;
  applyUrl: string | null;
}) {
  const toast = useToast();
  const [isSaved, setSaved] = useState(saved);
  const [isHidden, setHidden] = useState(hidden);
  const [, start] = useTransition();

  function toggle(kind: "save" | "hide") {
    const next = kind === "save" ? !isSaved : !isHidden;
    if (kind === "save") setSaved(next);
    else setHidden(next);
    start(async () => {
      await send(kind, jobId, next);
    });
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
        if (kind === "save") setSaved(!next);
        else setHidden(!next);
        void send(kind, jobId, !next);
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={isSaved ? "default" : "outline"}
        className="h-9 px-3"
        aria-pressed={isSaved}
        onClick={() => toggle("save")}
      >
        <Bookmark aria-hidden /> {isSaved ? "Saved" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-9 px-3" aria-pressed={isHidden} onClick={() => toggle("hide")}>
        <EyeOff aria-hidden /> {isHidden ? "Unhide" : "Hide"}
      </Button>
      <Link href={`/applications/new?job=${jobId}`} className={buttonVariants({ size: "sm", variant: "outline", className: "h-9 px-3" })}>
        <Plus aria-hidden /> Track
      </Link>
      {applyUrl ? (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={buttonVariants({ size: "sm", className: "h-9 px-4" })}
        >
          Apply<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}
