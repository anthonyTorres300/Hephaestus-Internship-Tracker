"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="grid max-w-md gap-3 rounded-md border p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">We could not load this page. Your data is safe. Check your connection and try again.</p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
