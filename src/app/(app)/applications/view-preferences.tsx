"use client";

import { APP_VIEW_COOKIE } from "@/lib/applications/prefs";
import { useEffect } from "react";

export function ViewPreferences({ layout, per }: { layout: "list" | "board"; per: number }) {
  useEffect(() => {
    document.cookie = `${APP_VIEW_COOKIE}=${encodeURIComponent(JSON.stringify({ layout, per }))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [layout, per]);
  return null;
}
