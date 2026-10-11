import { checkEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  const env = checkEnv();
  const contact = env.ok ? env.env.SUPPORT_EMAIL : undefined;
  return (
    <article className="prose prose-neutral mx-auto max-w-3xl px-4 py-12 dark:prose-invert [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
      <h1 className="text-3xl font-semibold">Privacy policy</h1>
      <p>Last updated: October 10, 2026.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account data: your email address and a salted password hash managed by our authentication provider.</li>
        <li>
          Profile data you choose to enter: school, degree, graduation month and year, time zone, work-authorization and sponsorship
          answers, preferred locations, skills and goals. Every question may be left unknown.
        </li>
        <li>
          Workspace content you create: applications, notes, tasks, interview and offer records, practice attempts, import files you stage.
        </li>
        <li>Operational data: counts, error codes and rate-limit records that do not include your notes or application content.</li>
      </ul>

      <h2>How it is used</h2>
      <p>
        Only to provide the service to you: showing your workspace, ranking shared listings against your own profile, enforcing quotas and
        keeping the service secure. We do not sell data, show ads, run tracking SDKs, or send your notes to third-party AI models.
      </p>

      <h2>Who can see it</h2>
      <p>
        Your workspace is private to your account. Administrators manage shared job sources, review operational health and can suspend
        accounts, but cannot read your applications, notes or practice records. Saving, hiding or applying to a shared listing is private to
        you.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>Supabase: authentication, database and private file storage.</li>
        <li>Vercel: web hosting.</li>
        <li>GitHub: public source lists and scheduled automation for the shared catalog (no user data).</li>
        <li>
          Google: company logos on job listings are loaded from Google&apos;s public favicon service. It sees the company website domain and
          your IP address, but no account data, and the request carries no referrer.
        </li>
        <li>
          LeetCode: only if you add your LeetCode username on the Practice page. The app then requests that public profile from
          leetcode.com. No password or cookie is ever used.
        </li>
      </ul>

      <h2>Export and deletion</h2>
      <p>
        You can export your data (CSV and JSON) at any time from Settings. You can delete your account from Settings after re-entering your
        password. Deletion blocks access immediately, then removes your files, rows and sign-in identity, targeted within seven days.
        Encrypted provider backups may retain data until they expire under the provider&apos;s backup schedule.
      </p>

      <h2>Retention</h2>
      <p>Operational logs are kept about 30 days. Temporary import files are removed after commit or cancel, or after seven days.</p>

      <h2>Contact</h2>
      <p>
        {contact ? (
          <>
            Questions or requests:{" "}
            <a className="underline" href={`mailto:${contact}`}>
              {contact}
            </a>
            .
          </>
        ) : (
          "Contact details are provided by the service operator."
        )}
      </p>
    </article>
  );
}
