import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuth } from "@/lib/auth/session";
import { ResendForm } from "../auth-forms";

export const metadata = { title: "Verify your email" };

export default async function Page() {
  const auth = await getAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          Open the link we emailed you to activate your workspace. Links expire; request a new one if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ResendForm email={auth?.user.email ?? undefined} />
        <Link href="/login" className="text-sm underline">
          Back to log in
        </Link>
      </CardContent>
    </Card>
  );
}
