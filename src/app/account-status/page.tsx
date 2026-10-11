import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccountState, getAuth } from "@/lib/auth/session";
import { checkEnv } from "@/lib/server/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Account status" };
export const dynamic = "force-dynamic";

export default async function AccountStatus() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const state = await getAccountState();
  if (state === "active" && auth.user.email_confirmed_at) redirect("/dashboard");
  const env = checkEnv();
  const contact = env.ok ? env.env.SUPPORT_EMAIL : undefined;

  let progress: string | null = null;
  if (state === "deletion_requested") {
    const { data } = await auth.supabase.from("account_deletion_requests").select("state, requested_at, retry_count").maybeSingle();
    progress = data
      ? `Deletion ${data.state.replace("_", " ")} (requested ${new Date(data.requested_at).toUTCString()}).`
      : "Deletion requested.";
  }

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            {state === "suspended"
              ? "Account suspended"
              : state === "deletion_requested"
                ? "Account deletion in progress"
                : "Workspace unavailable"}
          </CardTitle>
          <CardDescription>
            {state === "suspended"
              ? "Access to your workspace is paused."
              : state === "deletion_requested"
                ? "Your data is no longer accessible and is being removed."
                : "We could not load your workspace. Try again shortly."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {progress ? <p role="status">{progress}</p> : null}
          {state === "suspended" ? (
            <p>
              If you believe this is a mistake, contact support
              {contact ? (
                <>
                  {" "}
                  at{" "}
                  <a className="underline" href={`mailto:${contact}`}>
                    {contact}
                  </a>
                </>
              ) : null}
              .
            </p>
          ) : null}
          <div className="flex gap-3">
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
            <Link className="self-center underline" href="/">
              Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
