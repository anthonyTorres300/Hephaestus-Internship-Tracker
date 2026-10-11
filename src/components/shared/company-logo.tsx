"use client";

import { useState } from "react";
import { logoDomainCandidates, logoUrl } from "@/lib/jobs/company-logo";
import { cn } from "@/lib/utils";

// Always a fixed 48px square. The image is absolutely positioned so its natural size can never change the layout.
// Tries the employer's own domain, then a name-based guess; shows a gold letter tile when none loads.
export function CompanyLogo({
  company,
  applyUrl,
  className,
  size = "md",
}: {
  company: string;
  applyUrl?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const candidates = logoDomainCandidates(company, applyUrl);
  const [index, setIndex] = useState(0);
  const domain = candidates[index];
  const initial = (company.trim()[0] ?? "?").toUpperCase();

  return (
    <span
      aria-hidden
      className={cn(
        size === "xs" ? "size-8 min-h-8 min-w-8" : size === "sm" ? "size-9 min-h-9 min-w-9" : "size-12 min-h-12 min-w-12",
        "relative block shrink-0 grow-0 overflow-hidden",
        size === "xs" ? "rounded-full" : "rounded-md",
        domain ? "bg-white/95" : "bg-primary/10 ring-1 ring-primary/40 ring-inset",
        className,
      )}
    >
      {domain ? (
        // eslint-disable-next-line @next/next/no-img-element -- third-party favicon; no-referrer, lazy, with fallback
        <img
          key={domain}
          src={logoUrl(domain)}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={
            size === "xs"
              ? "absolute inset-1.5 size-5 object-contain"
              : size === "sm"
                ? "absolute inset-1 size-7 object-contain"
                : "absolute inset-1.5 size-9 object-contain"
          }
          // The favicon service returns a 16px default globe (even on 404); treat that as "no logo".
          onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setIndex((i) => i + 1)}
          onError={() => setIndex((i) => i + 1)}
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 grid place-items-center font-heading leading-none text-primary",
            size === "xs" ? "text-sm" : size === "sm" ? "text-lg" : "text-2xl",
          )}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
