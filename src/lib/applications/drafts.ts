import type { FormInitial } from "@/app/(app)/applications/application-form";
import { STATUSES } from "@/lib/domain/status";
const FIELDS = new Set([
  "company_name",
  "role_title",
  "priority",
  "status",
  "application_url",
  "portal_url",
  "requisition_id",
  "locations",
  "work_mode",
  "role_category",
  "season",
  "season_year",
  "season_pick",
  "contact_channel",
  "job_id",
  "date_known",
  "submitted_day",
  "submitted_month",
]);
export function draftFields(fd: FormData): Record<string, string> {
  return Object.fromEntries(
    [...fd]
      .filter(([key, value]) => FIELDS.has(key) && typeof value === "string")
      .map(([key, value]) => [key, String(value).slice(0, 2000)]),
  );
}
export function restoreInitial(fields: Record<string, string>, fallback: FormInitial = {}): FormInitial {
  const initial: FormInitial = { ...fallback, draftValues: fields };
  if (!("job_id" in fields)) initial.job_id = undefined;
  for (const key of [
    "company_name",
    "role_title",
    "priority",
    "application_url",
    "portal_url",
    "requisition_id",
    "work_mode",
    "role_category",
    "season",
    "contact_channel",
    "job_id",
  ] as const)
    if (key in fields) initial[key] = fields[key];
  if ((STATUSES as readonly string[]).includes(fields.status)) initial.status = fields.status as FormInitial["status"];
  if ("locations" in fields)
    initial.locations = fields.locations
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  if ("season_year" in fields) initial.season_year = Number(fields.season_year) || null;
  if (fields.date_known === "unknown") {
    initial.submitted_precision = "unknown";
    initial.submission_date_unknown = true;
  } else if (fields.date_known === "day" || fields.date_known === "month") {
    const [year, month, day] = ((fields.date_known === "month" ? fields.submitted_month : fields.submitted_day) ?? "")
      .split("-")
      .map(Number);
    initial.submitted_precision = fields.date_known === "month" ? "month" : "day";
    initial.submission_date_unknown = false;
    initial.submitted_year = year || null;
    initial.submitted_month = month || null;
    initial.submitted_day = day || null;
  }
  return initial;
}
export function continuingInitial(fd: FormData): FormInitial {
  const fields = draftFields(fd);
  return restoreInitial(
    Object.fromEntries(
      Object.entries(fields).filter(([key]) => ["season", "season_year", "date_known", "submitted_day", "submitted_month"].includes(key)),
    ),
    { status: "applied" },
  );
}
export function readApplicationDraft(
  storage: Pick<Storage, "getItem">,
  key: string,
  now = Date.now(),
): { fields: Record<string, string>; idem: string } | null {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 40000) return null;
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      typeof value.savedAt !== "number" ||
      now - value.savedAt > 7 * 86400000 ||
      typeof value.idem !== "string" ||
      value.idem.length < 8 ||
      value.idem.length > 128 ||
      !value.fields ||
      typeof value.fields !== "object" ||
      Array.isArray(value.fields)
    )
      return null;
    const fields = Object.fromEntries(
      Object.entries(value.fields).filter(([name, item]) => FIELDS.has(name) && typeof item === "string" && item.length <= 2000),
    ) as Record<string, string>;
    return { fields, idem: value.idem };
  } catch {
    return null;
  }
}
