import { parseImportDate, type ParsedImportDate } from "./dates";
import { fingerprintRow } from "./fingerprint";
import type { ColumnMap, ImportField } from "./parse";
import { mapStatus, type AppStatus } from "./status";

export interface Issue {
  code: string;
  message: string;
  field?: string;
  blocking?: boolean;
  [k: string]: unknown;
}

export interface ExistingAppKey {
  id: string;
  company_name: string;
  role_title: string;
  submitted_precision?: string | null;
  submitted_year?: number | null;
  submitted_month?: number | null;
  submitted_day?: number | null;
  confirmed_identity?: string | null;
  portal_url?: string | null;
}

export interface DatePart {
  year?: number;
  month?: number;
  day?: number;
  precision: string;
  raw: string;
}

export interface ProposedApplication {
  company_name: string;
  role_title: string;
  status: AppStatus | null;
  attested: boolean;
  submitted_precision?: string;
  submitted_year?: number;
  submitted_month?: number;
  submitted_day?: number;
  submission_date_unknown?: boolean;
  original_status?: string;
  original_application_date?: string;
  contact_channel?: string;
  portal_url?: string;
  application_url?: string;
  season?: string;
  season_year?: number;
  role_category?: string;
  priority?: string;
  offer?: DatePart & { needs_review: boolean };
  interview?: DatePart;
}

export const PROPOSED_KEYS = [
  "company_name",
  "role_title",
  "status",
  "attested",
  "submitted_precision",
  "submitted_year",
  "submitted_month",
  "submitted_day",
  "submission_date_unknown",
  "original_status",
  "original_application_date",
  "contact_channel",
  "portal_url",
  "application_url",
  "season",
  "season_year",
  "role_category",
  "priority",
  "offer",
  "interview",
] as const;

export interface StagedRow {
  ordinal: number;
  raw: Record<string, string>;
  proposed: ProposedApplication;
  fingerprint: string;
  warnings: Issue[];
  errors: Issue[];
  decision: "pending" | "accept" | "skip";
  statusReason?: string;
}

export interface StageOptions {
  columnMap: ColumnMap | Partial<Record<ImportField, number | null>>;
  statusMap?: Record<string, AppStatus>;
  nowIso?: string;
  existing?: ExistingAppKey[];
  attestSubmitted?: boolean;
  overrides?: Record<number, Partial<Record<ImportField, string>>>;
}

const SUBMITTED = (s: AppStatus) => s !== "saved" && s !== "prepared";

export const normText = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const identityKey = (company: string, title: string) => `${normText(company)}::${normText(title)}`;

export function inferRoleCategory(title: string): string | undefined {
  if (/\bco[\s-]?ops?\b/i.test(title)) return "co-op";
  if (/\bintern(ship)?s?\b/i.test(title)) return "internship";
  if (/\b(new[\s-]?grad(uate)?|early[\s-]?career|entry[\s-]?level|junior|associate|engineer\s+i|developer\s+i|analyst\s+i)\b/i.test(title))
    return "early_career";
  if (/\bfull[\s-]?time\b/i.test(title)) return "full_time";
  return undefined;
}

export function inferSeason(title: string): { season?: string; season_year?: number } {
  const m = title.match(/\b(summer|fall|autumn|winter|spring)\b(?:\W{0,3}(?:'(\d{2})\b|(20\d{2})\b))?/i);
  if (!m) {
    const r = title.match(/\b(20\d{2})\s+(summer|fall|autumn|winter|spring)\b/i);
    return r ? { season: r[2].toLowerCase().replace("autumn", "fall"), season_year: +r[1] } : {};
  }
  const year = m[3] ? +m[3] : m[2] ? 2000 + +m[2] : undefined;
  return { season: m[1].toLowerCase().replace("autumn", "fall"), ...(year ? { season_year: year } : {}) };
}

function httpsUrl(text: string): string | undefined {
  const m = text.match(/https:\/\/[^\s<>"']+/i);
  if (!m) return undefined;
  const cleaned = m[0].replace(/[.,;:)\]]+$/, "");
  try {
    const u = new URL(cleaned);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const datePart = (d: ParsedImportDate): DatePart => ({
  ...(d.year !== undefined ? { year: d.year } : {}),
  ...(d.month !== undefined ? { month: d.month } : {}),
  ...(d.day !== undefined ? { day: d.day } : {}),
  precision: d.precision,
  raw: d.raw,
});

const lowerBound = (d: ParsedImportDate) => (d.year === undefined ? null : Date.UTC(d.year, (d.month ?? 1) - 1, d.day ?? 1));

function sameDate(a: ParsedImportDate | null, e: ExistingAppKey): boolean {
  const ep = e.submitted_precision ?? "unknown";
  const ap = a && a.status !== "blank" && a.precision !== "unknown" ? a.precision : "unknown";
  if (ap !== ep) return false;
  if (ap === "unknown") return true;
  return (
    a?.year === e.submitted_year &&
    (a?.month ?? null) === (ep === "year" ? null : (e.submitted_month ?? null)) &&
    (a?.day ?? null) === (ep === "day" ? (e.submitted_day ?? null) : null)
  );
}

export function stageRows(table: { headers: string[]; rows: string[][] }, options: StageOptions): StagedRow[] {
  const now = new Date(options.nowIso ?? Date.now());
  const attest = options.attestSubmitted ?? true;
  const cm = options.columnMap;
  const existing = options.existing ?? [];
  const names = table.headers.map((h, i, arr) => (arr.indexOf(h) === i ? h : `${h}#${i + 1}`));
  const out: StagedRow[] = [];
  const seenFp = new Map<string, number>();
  const portalSeen = new Map<string, number[]>();
  let ordinal = 0;

  for (const cells of table.rows) {
    if (cells.every((c) => c.trim() === "")) continue;
    ordinal++;
    const raw: Record<string, string> = {};
    names.forEach((n, i) => (raw[n] = cells[i] ?? ""));
    const ov = options.overrides?.[ordinal];
    const get = (f: ImportField): string => {
      if (ov && ov[f] !== undefined) return ov[f]!.trim();
      const i = cm[f];
      return i === null || i === undefined ? "" : (cells[i] ?? "").trim();
    };
    const has = (f: ImportField) => (ov && ov[f] !== undefined) || (cm[f] !== null && cm[f] !== undefined);
    const warnings: Issue[] = [];
    const errors: Issue[] = [];
    const fingerprint = fingerprintRow(raw);

    const company = get("company_name");
    const role = get("role_title");
    if (!company) errors.push({ code: "missing_company", field: "company_name", message: "Company name is required." });
    if (!role) errors.push({ code: "missing_role", field: "role_title", message: "Position is required." });

    const statusRaw = get("original_status") || get("status");
    const statusCell = get("status");
    const ms = mapStatus(statusCell, options.statusMap ?? {});
    if (ms.needsMapping) {
      errors.push({
        code: "unmapped_status",
        field: "status",
        message: `Status "${statusCell}" needs a mapping or skip.`,
        label: statusCell,
      });
    }
    const status = ms.status;
    const submitted = status !== null && SUBMITTED(status);

    const dateRaw = get("application_date");
    const di = cm.application_date;
    const origDate = get("original_application_date") || (di === null || di === undefined ? "" : (cells[di] ?? "").trim());
    const appDate = parseImportDate(dateRaw, now);
    const checkDate = (d: ParsedImportDate, field: string, label: string, asError: boolean) => {
      if (d.status === "invalid") {
        (asError ? errors : warnings).push({ code: "invalid_date", field, message: `${label}: ${d.message}`, raw: d.raw });
      } else if (d.status === "ambiguous") {
        (asError ? errors : warnings).push({
          code: "ambiguous_date",
          field,
          message: `${label}: ${d.message}`,
          raw: d.raw,
          candidates: d.candidates ?? [],
        });
      } else if (d.status === "suspicious") {
        warnings.push({ code: "suspicious_date", field, message: `${label}: ${d.message}`, raw: d.raw, blocking: true });
      }
    };
    checkDate(appDate, "application_date", "Application date", true);

    const proposed: ProposedApplication = {
      company_name: company,
      role_title: role,
      status,
      attested: submitted && attest,
    };
    if (submitted) {
      if (appDate.status === "ok" || appDate.status === "suspicious") {
        proposed.submitted_precision = appDate.precision;
        if (appDate.year !== undefined) proposed.submitted_year = appDate.year;
        if (appDate.month !== undefined) proposed.submitted_month = appDate.month;
        if (appDate.day !== undefined) proposed.submitted_day = appDate.day;
        proposed.submission_date_unknown = false;
      } else {
        proposed.submitted_precision = "unknown";
        proposed.submission_date_unknown = appDate.status === "blank" || get("submission_date_unknown").toLowerCase() === "true";
      }
    }
    if (statusRaw) proposed.original_status = statusRaw;
    if (origDate) proposed.original_application_date = origDate;
    const progress = get("to_check_progress");
    if (progress) {
      proposed.contact_channel = progress;
      const url = httpsUrl(progress);
      if (url) proposed.portal_url = url;
    }
    const portalCol = httpsUrl(get("portal_url"));
    if (portalCol) proposed.portal_url = portalCol;
    const appUrl = httpsUrl(get("application_url"));
    if (appUrl) proposed.application_url = appUrl;
    const pri = get("priority").toLowerCase();
    if (["low", "medium", "high"].includes(pri)) proposed.priority = pri;

    const ex = inferSeason(role);
    const nativeSeason = get("season").toLowerCase();
    const nativeYear = Number(get("season_year"));
    if (ex.season) {
      proposed.season = ex.season;
      if (ex.season_year) proposed.season_year = ex.season_year;
    } else if (["summer", "fall", "winter", "spring"].includes(nativeSeason)) {
      proposed.season = nativeSeason;
      if (Number.isInteger(nativeYear) && nativeYear > 2000) proposed.season_year = nativeYear;
    }
    const cat = get("role_category") || inferRoleCategory(role);
    if (cat) proposed.role_category = cat.slice(0, 60);

    const offerRaw = get("offer_received");
    let offerDate: ParsedImportDate | null = null;
    if (has("offer_received") && offerRaw !== "") {
      const od = parseImportDate(offerRaw, now);
      if (od.status === "ok" || od.status === "suspicious") {
        offerDate = od;
        proposed.offer = { ...datePart(od), needs_review: false };
        checkDate(od, "offer_received", "Offer date", false);
      } else {
        proposed.offer = { precision: "unknown", raw: offerRaw, needs_review: true };
        warnings.push({
          code: "offer_needs_review",
          field: "offer_received",
          message: "Offer cell is not a date; kept as text for review.",
          raw: offerRaw,
        });
      }
    }

    const intRaw = get("interview_date");
    let intDate: ParsedImportDate | null = null;
    if (has("interview_date") && intRaw !== "") {
      intDate = parseImportDate(intRaw, now);
      checkDate(intDate, "interview_date", "Interview date", true);
      if (intDate.status === "ok" || intDate.status === "suspicious") proposed.interview = datePart(intDate);
      else proposed.interview = { precision: "unknown", raw: intRaw };
    }

    const base = appDate.status === "ok" || appDate.status === "suspicious" ? lowerBound(appDate) : null;
    for (const [d, f] of [
      [intDate, "interview_date"],
      [offerDate, "offer_received"],
    ] as const) {
      const lb = d && (d.status === "ok" || d.status === "suspicious") ? lowerBound(d) : null;
      if (base !== null && lb !== null && lb < base) {
        warnings.push({ code: "date_order", field: f, message: "Date is earlier than the application date.", blocking: true });
      }
    }

    if (company && role) {
      const nk = identityKey(company, role);
      for (const e of existing) {
        if (e.confirmed_identity && e.confirmed_identity === nk) {
          warnings.push({
            code: "confirmed_identity_match",
            message: "Matches a confirmed application identity.",
            blocking: true,
            existing_id: e.id,
          });
        } else if (identityKey(e.company_name, e.role_title) === nk && sameDate(submitted ? appDate : null, e)) {
          warnings.push({
            code: "possible_duplicate",
            message: "Same company, title and date as an existing application.",
            blocking: true,
            existing_id: e.id,
          });
        }
      }
    }

    const first = seenFp.get(fingerprint);
    if (first !== undefined) {
      warnings.push({
        code: "repeated_source_row",
        message: `Identical to source row ${first}; kept as a separate row for review.`,
        blocking: true,
        first_ordinal: first,
      });
    } else seenFp.set(fingerprint, ordinal);

    if (proposed.portal_url) {
      const key = proposed.portal_url;
      const prev = portalSeen.get(key) ?? [];
      const ext = existing.filter((e) => e.portal_url === key).length;
      if (prev.length || ext) {
        warnings.push({
          code: "portal_url_reused",
          message: "Candidate portal URL is shared with other applications (informational).",
          ordinals: prev,
          existing_count: ext,
        });
      }
      portalSeen.set(key, [...prev, ordinal]);
    }

    out.push({
      ordinal,
      raw,
      proposed,
      fingerprint,
      warnings,
      errors,
      decision: "pending",
      ...(ms.reason ? { statusReason: ms.reason } : {}),
    });
  }
  return out;
}

export interface StageSummary {
  nonblank: number;
  withErrors: number;
  withBlockingWarnings: number;
  skipped: number;
  accepted: number;
  pending: number;
  commitReady: boolean;
}

export function summarizeStaged(rows: StagedRow[]): StageSummary {
  const live = rows.filter((r) => r.decision !== "skip");
  const withErrors = live.filter((r) => r.errors.length > 0).length;
  const blocking = live.filter((r) => r.decision === "pending" && r.warnings.some((w) => w.blocking)).length;
  return {
    nonblank: rows.length,
    withErrors,
    withBlockingWarnings: blocking,
    skipped: rows.length - live.length,
    accepted: rows.filter((r) => r.decision === "accept").length,
    pending: rows.filter((r) => r.decision === "pending").length,
    commitReady: withErrors === 0 && blocking === 0,
  };
}

export function countsReconcile(c: { created: number; linked: number; skipped: number; failed: number }, nonblank: number): boolean {
  return c.created + c.linked + c.skipped + c.failed === nonblank;
}
