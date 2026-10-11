import { formatPartialDate, type PartialDate } from "@/lib/domain";
import type { Application } from "@/lib/data/types";

export function submissionLabel(
  a: Pick<
    Application,
    "submitted_precision" | "submitted_year" | "submitted_month" | "submitted_day" | "submission_date_unknown" | "status"
  >,
): string {
  if (a.status === "saved" || a.status === "prepared") return "Not submitted";
  if (a.submission_date_unknown || a.submitted_precision === "unknown") return "Date unknown";
  return formatPartialDate({
    precision: a.submitted_precision,
    year: a.submitted_year ?? undefined,
    month: a.submitted_month ?? undefined,
    day: a.submitted_day ?? undefined,
  } as PartialDate);
}

export const fmtInstant = (iso: string | null | undefined, tz: string) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)) : "—";

export const fmtDateOnly = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "—";

export const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const fmtDate = (iso: string | null | undefined, tz: string) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: tz }).format(new Date(iso)) : "—";

export const seasonLabel = (season: string | null | undefined, year?: number | null) =>
  season ? `${season[0].toUpperCase()}${season.slice(1)}${year ? ` ${year}` : ""}` : "Season unknown";

export const fmtWeek = (isoDate: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
