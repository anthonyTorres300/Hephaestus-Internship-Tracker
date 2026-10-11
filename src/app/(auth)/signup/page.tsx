import { checkEnv } from "@/lib/server/env";
import { SignupForm } from "../auth-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

export default function SignupPage() {
  const env = checkEnv();
  return <SignupForm open={env.ok && env.env.REGISTRATION_MODE === "public"} />;
}
