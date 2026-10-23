"use client";

import { useEffect } from "react";
import { useQuickLog } from "@/components/applications/quick-log";

// "/" focuses the page's search box; "n" starts a new application. Ignored while typing or when a modifier key is held.
export function Shortcuts() {
  const workflow = useQuickLog();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>('input[type="search"], input[name="q"]');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      } else if (e.key === "n") {
        e.preventDefault();
        workflow?.open();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [workflow]);
  return null;
}
