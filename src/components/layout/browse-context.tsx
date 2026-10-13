"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Remember the list URL and its scroll position before opening a detail page.
export function BrowseContext({ section }: { section: "applications" | "jobs" }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== `/${section}`) return;
    const save = () => {
      try {
        sessionStorage.setItem(`browse:${section}`, JSON.stringify({ url: location.pathname + location.search, scroll: window.scrollY }));
      } catch {}
    };
    const restore = () => {
      try {
        const value = JSON.parse(sessionStorage.getItem(`browse:${section}`) ?? "null");
        if (value?.url === location.pathname + location.search && Number.isFinite(value.scroll)) window.scrollTo(0, value.scroll);
      } catch {}
    };
    restore();
    document.addEventListener("click", save, true);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("click", save, true);
      window.removeEventListener("pagehide", save);
    };
  }, [pathname, section]);
  return null;
}

export function BackToList({ section }: { section: "applications" | "jobs" }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        let target = `/${section}`;
        try {
          const saved = JSON.parse(sessionStorage.getItem(`browse:${section}`) ?? "null");
          if (typeof saved?.url === "string" && (saved.url === target || saved.url.startsWith(target + "?"))) target = saved.url;
        } catch {}
        router.push(target, { scroll: false });
      }}
    >
      Back to {section}
    </Button>
  );
}
