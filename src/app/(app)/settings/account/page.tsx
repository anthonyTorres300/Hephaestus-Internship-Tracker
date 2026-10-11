import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { displayName } from "@/lib/auth/display-name";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DeleteAccountForm, NameForm, PasswordResetButton } from "./account-forms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const { supabase, user } = await requireWorkspace();
  const head = (t: string) => supabase.from(t).select("id", { count: "exact", head: true });
  const [apps, attempts] = await Promise.all([head("applications"), head("practice_attempts")]);
  const rows = [
    { label: "Applications (including trash)", used: apps.count ?? 0, max: 2000, text: `${apps.count ?? 0} of 2,000` },
    { label: "Practice attempts", used: attempts.count ?? 0, max: 10000, text: `${attempts.count ?? 0} of 10,000` },
  ];
  return (
    <>
      <PageHeader
        title="Account"
        description={user.email ?? ""}
        actions={
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            Profile settings
          </Link>
        }
      />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your name</CardTitle>
            <CardDescription>How the app greets you.</CardDescription>
          </CardHeader>
          <CardContent>
            <NameForm initial={displayName(user) ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage and limits</CardTitle>
            <CardDescription>Limits keep the service available to everyone. Export or delete data to free space.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="text-muted-foreground">{r.text}</span>
                </div>
                <Progress value={Math.min(100, (r.used / r.max) * 100)} aria-label={r.label} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export your data</CardTitle>
            <CardDescription>
              CSV opens in spreadsheets. JSON includes everything, including original imported values and date precision.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a className={buttonVariants({ variant: "outline" })} href="/api/export?format=csv">
              Applications (CSV)
            </a>
            <a className={buttonVariants({ variant: "outline" })} href="/api/export?format=json">
              Everything (JSON)
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Send a password reset link to {user.email}.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordResetButton email={user.email ?? ""} />
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              This blocks access immediately and permanently removes your applications, notes and practice history and sign-in. Deletion
              completes within seven days. Provider backups expire on their own schedule. Please export first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
