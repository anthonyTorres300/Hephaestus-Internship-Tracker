import { checkEnv } from "@/lib/server/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

export default function Setup() {
  const env = checkEnv();
  const problems = env.ok ? [] : env.problems;
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{env.ok ? "Configuration looks complete" : "Setup required"}</CardTitle>
          <CardDescription>
            {env.ok
              ? "All required environment variables are present."
              : "This deployment is missing configuration, so sign-in and your workspace are unavailable."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {problems.length ? (
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase project values, then restart. See the README
            for the full checklist.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
