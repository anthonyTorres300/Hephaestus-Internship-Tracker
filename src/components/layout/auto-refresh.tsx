"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toast";

const KEY = "hephaestus_auto_refresh_at";
const ERR_KEY = "hephaestus_auto_refresh_error";
const COOLDOWN_MS = 10 * 60_000; // do not re-check on every navigation

// Quietly checks for new listings when the catalog is stale, then refreshes the page. Renders nothing unless asked to show the button.
export function AutoRefresh({ stale, configured, showButton = false }: { stale: boolean; configured: boolean; showButton?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const request = useCallback(
    async (force: boolean) => {
      try {
        const res = await fetch("/api/discovery/auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        const body = await res.json().catch(() => ({}));
        if (body?.status === "refreshed") {
          toast({
            message:
              body.new_jobs > 0 ? `${body.new_jobs} new listing${body.new_jobs === 1 ? "" : "s"} loaded.` : "Listings are up to date.",
          });
          router.refresh();
        } else if (res.ok === false && body?.error?.message) {
          // Explain failures instead of staying silent (automatic checks only speak up once per session).
          let quiet = false;
          if (!force) {
            try {
              quiet = sessionStorage.getItem(ERR_KEY) === "1";
              sessionStorage.setItem(ERR_KEY, "1");
            } catch {
              quiet = false;
            }
          }
          if (!quiet && body.error.code !== "not_configured") toast({ message: body.error.message });
        } else if (force && body?.status === "fresh") toast({ message: "Listings were refreshed a few minutes ago." });
        else if (force && body?.status === "running") toast({ message: "A refresh is already running. Check back in a minute." });
        else if (force && body?.status === "failed") toast({ message: "The refresh could not finish. Try again later." });
      } catch {
        if (force) toast({ message: "Could not reach the server." });
      }
    },
    [router, toast],
  );

  useEffect(() => {
    if (!configured || !stale || started.current) return;
    started.current = true;
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < COOLDOWN_MS) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // sessionStorage unavailable: just try once
    }
    void request(false);
  }, [configured, stale, request]);

  async function onClick() {
    setBusy(true);
    await request(true);
    setBusy(false);
  }

  if (!showButton || !configured) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={busy} aria-live="polite">
      <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden /> {busy ? "Checking…" : "Refresh"}
    </Button>
  );
}
