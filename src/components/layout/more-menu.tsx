"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

// Small "…" dropdown for secondary actions. Closes on outside click and Escape; the panel holds plain links.
export function MoreMenu({ label = "More actions", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal aria-hidden />
      </Button>
      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 z-50 mt-2 grid w-52 gap-0.5 rounded-md bg-popover p-1.5 text-sm shadow-xl ring-1 ring-white/15 [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2 [&_a:hover]:bg-white/10"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
