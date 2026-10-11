export const TWO_DIGIT_YEAR_RULE = "Two-digit years are read as 2000-2099 for this importer (25 becomes 2025).";

export const MIN_PLAUSIBLE_YEAR = 2015;

export type DatePrecision = "day" | "month" | "year" | "unknown";
export type DateStatus = "ok" | "blank" | "ambiguous" | "invalid" | "suspicious";

export interface DateCandidate {
  year: number;
  month: number;
  day?: number;
  label: string;
}

export interface ParsedImportDate {
  precision: DatePrecision;
  year?: number;
  month?: number;
  day?: number;
  raw: string;
  status: DateStatus;
  message?: string;
  rule?: string;
  candidates?: DateCandidate[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function monthOf(tok: string): number | null {
  const t = tok.toLowerCase();
  if (t.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.startsWith(t));
  return i >= 0 ? i + 1 : null;
}

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function expandYear(s: string): { year: number; two: boolean } {
  return s.length === 2 ? { year: 2000 + Number(s), two: true } : { year: Number(s), two: false };
}

const SEP = "[\\s.,\\-/]";
const MON = "([A-Za-z]{3,9})";

/**
 * Suspicious (kept as-is, never corrected, never inferred from neighbouring rows):
 * year before 2015, or earliest instant of the value later than now + 1 year.
 */
function judge(r: ParsedImportDate, now: Date): ParsedImportDate {
  if (r.status !== "ok" || r.year === undefined) return r;
  const limit = new Date(now.getTime());
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  const start = Date.UTC(r.year, (r.month ?? 1) - 1, r.day ?? 1);
  if (r.year < MIN_PLAUSIBLE_YEAR) {
    return { ...r, status: "suspicious", message: `Year ${r.year} is before ${MIN_PLAUSIBLE_YEAR}; kept as written for review.` };
  }
  if (start > limit.getTime()) {
    return { ...r, status: "suspicious", message: "Date is more than a year in the future; kept as written for review." };
  }
  return r;
}

export function parseImportDate(raw: string, now: Date = new Date()): ParsedImportDate {
  const s = raw.replace(/[​-‏﻿]/g, "").trim();
  const base = { raw, precision: "unknown" as DatePrecision };
  if (s === "") return { ...base, status: "blank" };
  const invalid = (message: string): ParsedImportDate => ({ ...base, status: "invalid", message });
  const make = (y: number, m: number | undefined, d: number | undefined, rule: string, two: boolean): ParsedImportDate => {
    const rl = two ? `${rule}+two_digit_year` : rule;
    if (m !== undefined && d !== undefined && !validDay(y, m, d)) return invalid("Not a real calendar date.");
    if (m !== undefined && (m < 1 || m > 12)) return invalid("Month out of range.");
    const precision: DatePrecision = d !== undefined ? "day" : m !== undefined ? "month" : "year";
    return judge(
      { ...base, precision, year: y, month: m, day: d, status: "ok", rule: rl, ...(two ? { message: TWO_DIGIT_YEAR_RULE } : {}) },
      now,
    );
  };

  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)) || (m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/))) {
    return make(+m[1], +m[2], +m[3], "iso", false);
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) return make(+m[1], +m[2], undefined, "iso_month", false);
  if ((m = s.match(/^(\d{4})$/))) return make(+m[1], undefined, undefined, "year_only", false);

  if ((m = s.match(new RegExp(`^${MON}${SEP}*(\\d{1,2})(?:st|nd|rd|th)?${SEP}+(\\d{4}|\\d{2})$`)))) {
    const mo = monthOf(m[1]);
    if (mo) {
      const { year, two } = expandYear(m[3]);
      return make(year, mo, +m[2], "named_month_day_year", two);
    }
  }
  if ((m = s.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?${SEP}+${MON}${SEP}+(\\d{4}|\\d{2})$`)))) {
    const mo = monthOf(m[2]);
    if (mo) {
      const { year, two } = expandYear(m[3]);
      return make(year, mo, +m[1], "day_named_month_year", two);
    }
  }
  if ((m = s.match(new RegExp(`^${MON}${SEP}*(\\d{4})$`)))) {
    const mo = monthOf(m[1]);
    if (mo) return make(+m[2], mo, undefined, "named_month_year", false);
  }
  if ((m = s.match(new RegExp(`^${MON}${SEP}*(\\d{1,2})$`)))) {
    const mo = monthOf(m[1]);
    if (mo) {
      const n = m[2];
      const cands: DateCandidate[] = [];
      if (validDay(2000 + Number(n), mo, 1) && n.length === 2) {
        cands.push({ year: 2000 + Number(n), month: mo, label: `month ${MONTHS[mo - 1]} 20${n}` });
      }
      return { ...base, status: "ambiguous", message: "Month plus one number: day without year, or two-digit year?", candidates: cands };
    }
  }
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})$/))) {
    const a = +m[1];
    const b = +m[2];
    const { year, two } = expandYear(m[3]);
    if (a > 12 && b > 12) return invalid("Neither part can be a month.");
    if (a > 12) return make(year, b, a, "numeric_day_month", two);
    if (b > 12 || a === b) return make(year, a, b, "numeric_month_day", two);
    const cands: DateCandidate[] = [];
    if (validDay(year, a, b)) cands.push({ year, month: a, day: b, label: "month/day" });
    if (validDay(year, b, a)) cands.push({ year, month: b, day: a, label: "day/month" });
    if (cands.length === 0) return invalid("Not a real calendar date.");
    return { ...base, status: "ambiguous", message: "Numeric date could be month/day or day/month; owner must choose.", candidates: cands };
  }
  return invalid("Unrecognized date format.");
}
