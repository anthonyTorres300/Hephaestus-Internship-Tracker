"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-live="polite">
      <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
