import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInstant } from "@/lib/ui/format";
import { AdminNav } from "../admin-nav";
import { AccountStateForm } from "../admin-forms";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase, profile, user } = await requireAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { data } = await supabase.rpc("admin_list_accounts", { p_limit: 50, p_offset: (page - 1) * 50 });
  const rows = (data ?? []) as {
    user_id: string;
    email: string;
    created_at: string;
    email_confirmed: boolean;
    state: string;
    is_admin: boolean;
  }[];
  return (
    <>
      <PageHeader
        title="Admin"
        description="Identity and account state only. Administrators cannot open any user's applications, notes, resumes or practice records."
      />
      <AdminNav active="users" />
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Suspension blocks database and storage access immediately, even for existing sessions. Administrator roles are granted by the
            operator, never here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {rows.map((u) => (
            <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span className="grid">
                <span className="font-medium">{u.email}</span>
                <span className="text-xs text-muted-foreground">
                  Joined {fmtInstant(u.created_at, profile.timezone)} · {u.email_confirmed ? "verified" : "unverified"}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={u.state === "active" ? "secondary" : "destructive"}>{u.state.replace(/_/g, " ")}</Badge>
                {u.is_admin ? <Badge variant="outline">admin</Badge> : null}
                {u.state !== "deletion_requested" && u.user_id !== user.id ? (
                  <AccountStateForm userId={u.user_id} suspended={u.state === "suspended"} />
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
