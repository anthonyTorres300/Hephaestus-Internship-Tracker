import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/shared/company-logo";
import { availabilityLabel, type FeedItem } from "@/lib/jobs/feed";
import { fmtDate, seasonLabel } from "@/lib/ui/format";
import { JobActions } from "./job-actions";

export function JobRow({ item, tz, now }: { item: FeedItem; tz: string; now: Date }) {
  const { job, eligibility, userJob } = item;
  const avail = availabilityLabel(item, now);
  const place = (job.locations ?? []).slice(0, 2).join(" · ") || "Location unknown";
  const more = (job.locations ?? []).length - 2;
  return (
    <li className="grid gap-3 rounded-lg bg-card p-4 ring-1 ring-white/10 lg:min-h-28 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <CompanyLogo company={job.company} applyUrl={job.apply_url} />
        <div className="grid min-w-0 gap-1">
          <Link href={`/jobs/${job.id}`} className="text-base font-semibold underline-offset-2 hover:underline">
            {job.company}
          </Link>
          <p className="text-sm text-foreground/80">{job.title}</p>
          <p className="text-xs text-muted-foreground">
            {place}
            {more > 0 ? ` +${more}` : ""} · {seasonLabel(job.season, job.season_year)} · first seen {fmtDate(job.first_seen_at, tz)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {now.getTime() - new Date(job.first_seen_at).getTime() <= 48 * 3600_000 ? <Badge>New</Badge> : null}
            {eligibility.result === "ineligible" ? <Badge variant="destructive">Mismatch</Badge> : null}
            {avail.tone === "warn" ? <Badge variant="outline">{avail.text}</Badge> : null}
            {item.applied ? <Badge variant="secondary">Already applied</Badge> : null}
            {item.possiblePrevious ? <Badge variant="outline">Possible previous application</Badge> : null}
          </div>
        </div>
      </div>
      <JobActions
        key={`${job.id}:${!!userJob?.saved}:${!!userJob?.hidden}:${item.applicationId ?? ""}`}
        applicationId={item.applicationId}
        jobId={job.id}
        saved={!!userJob?.saved}
        hidden={!!userJob?.hidden}
        applyUrl={job.apply_url}
      />
    </li>
  );
}
