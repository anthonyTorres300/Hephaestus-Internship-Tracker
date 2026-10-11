"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncTimezoneAction } from "@/app/(app)/settings/actions";

export function TimezoneSync({ confirmed }: { confirmed: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (confirmed) return;
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (tz) syncTimezoneAction(tz).then(() => router.refresh());
  }, [confirmed, router]);
  return null;
}
