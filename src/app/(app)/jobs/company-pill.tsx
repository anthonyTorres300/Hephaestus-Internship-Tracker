"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { cn } from "@/lib/utils";

function Count({ n }: { n: number }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-4 animate-spin text-primary" aria-label="Loading" />
  ) : (
    <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
  );
}

function Name({ name, active }: { name: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span className={cn("min-w-0 flex-1 truncate", (active || pending) && "font-medium text-primary", pending && "animate-pulse")}>
      {name}
    </span>
  );
}

// Compact company filters wrap naturally and show a spinner while results load.
export function CompanyPill({ name, count, href, active }: { name: string; count: number; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      title={`${count} listing${count === 1 ? "" : "s"} at ${name}`}
      className={cn(
        "flex h-10 w-fit max-w-52 items-center gap-2 rounded-full bg-card pr-3 pl-1 text-sm whitespace-nowrap ring-1 ring-border transition-colors hover:ring-ring/50",
        active && "bg-primary/15 ring-primary/50",
      )}
    >
      <CompanyLogo company={name} applyUrl={null} size="xs" />
      <Name name={name} active={active} />
      <Count n={count} />
    </Link>
  );
}
