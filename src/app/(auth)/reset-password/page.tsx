import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { ResetForm } from "../auth-forms";

export const metadata = { title: "Reset password" };

export default async function Page() {
  const auth = await getAuth();
  if (!auth) redirect("/forgot-password");
  return <ResetForm />;
}
