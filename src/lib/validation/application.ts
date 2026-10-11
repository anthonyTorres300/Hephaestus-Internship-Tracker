import { z } from "zod";
import { STATUSES, PRIORITIES, isSubmittedStatus, type Status } from "@/lib/domain";
import { checkbox, optInt, optText, optionalUrl, reqText, splitList } from "./common";

const SEASONS = ["summer", "fall", "winter", "spring"] as const;
const WORK_MODES = ["onsite", "hybrid", "remote", "unknown"] as const;
const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const dateKnownSchema = z.enum(["day", "month", "unknown"]).default("day");

export interface SubmissionFields {
  submitted_precision: "day" | "month" | "unknown";
  submitted_year?: number;
  submitted_month?: number;
  submitted_day?: number;
  submission_date_unknown: boolean;
}

export function parseSubmission(
  known: string,
  day: string | undefined,
  month: string | undefined,
): { value?: SubmissionFields; error?: string } {
  if (known === "unknown") return { value: { submitted_precision: "unknown", submission_date_unknown: true } };
  if (known === "month") {
    const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
    if (!m || +m[2] < 1 || +m[2] > 12) return { error: "Choose a valid month." };
    return { value: { submitted_precision: "month", submitted_year: +m[1], submitted_month: +m[2], submission_date_unknown: false } };
  }
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!d) return { error: "Choose the submission date, or mark it unknown." };
  const iso = new Date(`${d[0]}T00:00:00Z`);
  if (Number.isNaN(iso.getTime()) || iso.toISOString().slice(0, 10) !== d[0]) return { error: "That date does not exist." };
  return {
    value: {
      submitted_precision: "day",
      submitted_year: +d[1],
      submitted_month: +d[2],
      submitted_day: +d[3],
      submission_date_unknown: false,
    },
  };
}

export const applicationBase = z.object({
  company_name: reqText(200, "Company"),
  role_title: reqText(300, "Role title"),
  priority: z.enum(PRIORITIES).default("medium"),
  application_url: optionalUrl,
  portal_url: optionalUrl,
  requisition_id: optText(100),
  work_mode: z.preprocess(emptyToUndef, z.enum(WORK_MODES).optional()),
  role_category: optText(60),
  season: z.preprocess(emptyToUndef, z.enum(SEASONS).optional()),
  season_year: optInt(2000, 2100),
  locations: z.preprocess((v) => splitList(typeof v === "string" ? v : ""), z.array(z.string().max(100)).max(20)),
  contact_channel: optText(300),
  job_id: z.preprocess(emptyToUndef, z.string().uuid().optional()),
});

export const createApplicationSchema = applicationBase.extend({
  status: z.enum(STATUSES).default("prepared"),
  attested: checkbox,
  date_known: dateKnownSchema,
  submitted_day: optText(10),
  submitted_month: optText(7),
  idem: z.string().min(8).max(128),
});

export const updateApplicationSchema = applicationBase.omit({ job_id: true }).extend({
  id: z.string().uuid(),
  revision: z.coerce.number().int().min(1),
  date_known: dateKnownSchema.optional(),
  submitted_day: optText(10),
  submitted_month: optText(7),
});

export const statusChangeSchema = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().min(1),
  status: z.enum(STATUSES),
  reason: optText(500),
  effective_at: optText(40),
  attested: checkbox,
  date_known: dateKnownSchema,
  submitted_day: optText(10),
  submitted_month: optText(7),
  idem: z.string().min(8).max(128),
});

export const noteSchema = z.object({ application_id: z.string().uuid(), body: reqText(10000, "Note") });
export const noteEditSchema = z.object({ id: z.string().uuid(), application_id: z.string().uuid(), body: reqText(10000, "Note") });

export const interviewSchema = z.object({
  application_id: z.string().uuid(),
  round_number: optInt(1, 20),
  round_type: z.preprocess(emptyToUndef, z.enum(["recruiter", "technical", "behavioral", "onsite", "final", "other"]).optional()),
  scheduled_local: optText(16),
  timezone: optText(64),
  outcome: z.enum(["pending", "passed", "failed", "cancelled", "unknown"]).default("pending"),
  notes: optText(5000),
});

export const taskSchema = z.object({
  application_id: z.preprocess(emptyToUndef, z.string().uuid().optional()),
  kind: z.enum(["application_deadline", "follow_up", "offer_deadline", "review"]),
  due_kind: z.enum(["date", "time"]).default("date"),
  due_date: optText(10),
  due_local: optText(16),
  note: optText(2000),
  evidence: optText(500),
  source: z.enum(["user", "source_claim"]).default("user"),
});

export function needsSubmission(status: Status) {
  return isSubmittedStatus(status);
}
