import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/server/env";
import { getAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isConfigured()) redirect("/setup");
  const auth = await getAuth();
  redirect(auth?.user.email_confirmed_at ? "/dashboard" : "/login");
}
