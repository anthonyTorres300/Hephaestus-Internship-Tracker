"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Thin top bar that appears as soon as an internal link is clicked and disappears when the new route renders.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Remembers which route the click happened on; once the route changes the bar is no longer "for" the current one.
  const here = `${pathname}?${search}`;
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const loading = startedOn === here;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setStartedOn(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!loading) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
