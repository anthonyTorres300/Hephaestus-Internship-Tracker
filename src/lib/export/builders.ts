import { toCsv } from "./csv";

export const EXPORT_HEADERS = [
  "company_name",
  "role_title",
  "status",
  "original_status",
  "role_category",
  "season",
  "season_year",
  "submitted_date",
  "submitted_precision",
  "submission_date_unknown",
  "original_application_date",
  "priority",
  "application_url",
  "portal_url",
  "contact_channel",
  "resume",
  "notes_count",
  "created_at",
  "exported_at",
] as const;

export interface ExportApplication {
  id?: string;
  company_name: string;
  role_title: string;
  status: string;
  original_status?: string | null;
  role_category?: string | null;
  season?: string | null;
  season_year?: number | null;
  submitted_precision?: string | null;
  submitted_year?: number | null;
  submitted_month?: number | null;
  submitted_day?: number | null;
  submission_date_unknown?: boolean | null;
  original_application_date?: string | null;
  priority?: string | null;
  application_url?: string | null;
  portal_url?: string | null;
  contact_channel?: string | null;
  resume_version_id?: string | null;
  created_at?: string | null;
}

export interface ExportContext {
  now?: Date;
  resumeLabels?: Record<string, string>;
  noteCounts?: Record<string, number>;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function formatSubmittedDate(a: ExportApplication): string {
  const p = a.submitted_precision ?? "unknown";
  if (a.submitted_year == null || p === "unknown") return "";
  if (p === "year") return pad(a.submitted_year, 4);
  if (p === "month" && a.submitted_month != null) return `${pad(a.submitted_year, 4)}-${pad(a.submitted_month)}`;
  if (p === "day" && a.submitted_month != null && a.submitted_day != null) {
    return `${pad(a.submitted_year, 4)}-${pad(a.submitted_month)}-${pad(a.submitted_day)}`;
  }
  return "";
}

export function applicationsToCsv(apps: readonly ExportApplication[], ctx: ExportContext = {}, opts: { bom?: boolean } = {}): string {
  const exportedAt = (ctx.now ?? new Date()).toISOString();
  const rows = apps.map((a) => [
    a.company_name,
    a.role_title,
    a.status,
    a.original_status,
    a.role_category,
    a.season,
    a.season_year,
    formatSubmittedDate(a),
    a.submitted_precision ?? "unknown",
    a.submission_date_unknown ? "true" : "false",
    a.original_application_date,
    a.priority,
    a.application_url,
    a.portal_url,
    a.contact_channel,
    a.resume_version_id ? (ctx.resumeLabels?.[a.resume_version_id] ?? "") : "",
    a.id ? (ctx.noteCounts?.[a.id] ?? 0) : 0,
    a.created_at,
    exportedAt,
  ]);
  return toCsv(EXPORT_HEADERS, rows, opts);
}

export class ExportOwnershipError extends Error {
  constructor(collection: string) {
    super(`Refusing export: ${collection} contains rows owned by another user`);
    this.name = "ExportOwnershipError";
  }
}

export const EXPORT_SCHEMA_VERSION = 1;

export interface OwnerExportInput {
  user_id: string;
  now?: Date;
  profile?: Record<string, unknown> | null;
  [collection: string]: unknown;
}

/**
 * Callers must pass rows already filtered by RLS / user_id. Only passed collections are emitted;
 * any row carrying a different user_id aborts the export. Text is kept exact (no CSV escaping).
 */
export function ownerExportJson(input: OwnerExportInput): Record<string, unknown> {
  const { user_id, now, ...rest } = input;
  const out: Record<string, unknown> = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: (now ?? new Date()).toISOString(),
    user_id,
  };
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    const items = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
    for (const item of items) {
      const owner = item && typeof item === "object" ? (item as { user_id?: unknown }).user_id : undefined;
      if (owner !== undefined && owner !== user_id) throw new ExportOwnershipError(key);
    }
    out[key] = value;
  }
  return out;
}

export function exportFilename(kind: string, ext: "csv" | "json", now: Date = new Date()): string {
  const safe =
    kind
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export";
  const iso = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `hephaestus-${safe}-${iso}.${ext}`;
}
