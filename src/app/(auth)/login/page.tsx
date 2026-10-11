import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { LoginForm } from "../auth-forms";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const auth = await getAuth();
  if (auth?.user.email_confirmed_at) redirect(safeNextPath(sp.next));
  return <LoginForm next={sp.next} linkError={sp.error === "link_invalid"} deleted={sp.deleted === "1"} />;
}
