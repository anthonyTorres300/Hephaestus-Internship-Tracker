import { checkEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of service" };

export default function Terms() {
  const env = checkEnv();
  const contact = env.ok ? env.env.SUPPORT_EMAIL : undefined;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
      <h1 className="text-3xl font-semibold">Terms of service</h1>
      <p>Last updated: October 10, 2026.</p>

      <h2>The service</h2>
      <p>
        Hephaestus is a personal organization tool. It does not apply to jobs for you, contact employers, guarantee interviews or offers, or
        verify that a position is open.
      </p>

      <h2>Listings and eligibility</h2>
      <p>
        Shared listings come from community-maintained public lists and may be wrong, stale or closed. Eligibility results and relevance
        scores are estimates based on information you provided and what the source states. They are not employer decisions. Always confirm
        details on the employer&apos;s own site.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use your own account; keep your credentials private.</li>
        <li>Do not attempt to access other users&apos; data, probe or overload the service, or bypass quotas and rate limits.</li>
        <li>Do not automate signups or scrape the service.</li>
      </ul>

      <h2>Limits</h2>
      <p>
        Accounts have storage and record limits (for example, 2,000 applications) so the service remains available to everyone. Accounts may
        be suspended for abuse. The service is provided as is, without a guarantee of uninterrupted availability; export your data
        regularly.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms and will record the version you accepted at signup.</p>

      <h2>Contact</h2>
      <p>
        {contact ? (
          <>
            <a className="underline" href={`mailto:${contact}`}>
              {contact}
            </a>
          </>
        ) : (
          "Contact details are provided by the service operator."
        )}
      </p>
    </article>
  );
}
