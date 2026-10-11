import { displayName } from "@/lib/auth/display-name";
import { Suspense } from "react";
import { ToastProvider } from "@/components/feedback/toast";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { SOURCES } from "@/lib/discovery/sources";
import { isStale } from "@/lib/jobs/freshness";
import { Shortcuts } from "@/components/layout/shortcuts";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, profile, supabase } = await requireWorkspace();
  return (
    <ToastProvider>
      <AppShell
        name={displayName(user) ?? "Account"}
        email={user.email ?? ""}
        isAdmin={isAdmin}
        logout={
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        }
      >
        <TimezoneSync confirmed={profile.timezone_confirmed} />
        <Shortcuts />
        <Suspense fallback={null}>
          <AutoRefreshGate supabase={supabase} />
        </Suspense>
        {children}
      </AppShell>
    </ToastProvider>
  );
}

// Listings older than 6 hours trigger a quiet background refresh (only when the server has the ingestion credentials).
// Streamed in separately so this lookup never delays the page itself.
async function AutoRefreshGate({ supabase }: { supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"] }) {
  const { data: health } = await supabase.from("feed_health").select("last_success_at");
  const last = (health ?? [])
    .map((h) => h.last_success_at)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;
  const stale = isStale(last) || (health ?? []).length < SOURCES.length;
  return <AutoRefresh stale={stale} configured={!!process.env.DISCOVERY_DATABASE_URL} />;
}
