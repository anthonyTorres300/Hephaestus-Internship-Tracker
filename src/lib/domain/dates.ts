import { DateTime } from "luxon";

export type DatePrecision = "day" | "month" | "year" | "unknown";

export interface PartialDate {
  precision: DatePrecision;
  year?: number;
  month?: number;
  day?: number;
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export function isValidPartialDate(d: PartialDate): boolean {
  switch (d.precision) {
    case "unknown":
      return true;
    case "year":
      return isInt(d.year) && d.year >= 1900 && d.year <= 2200;
    case "month":
      return isInt(d.year) && isInt(d.month) && d.year >= 1900 && d.year <= 2200 && d.month >= 1 && d.month <= 12;
    case "day":
      return (
        isInt(d.year) && isInt(d.month) && isInt(d.day) && d.year >= 1900 && d.year <= 2200 && DateTime.utc(d.year, d.month, d.day).isValid
      );
    default:
      return false;
  }
}

export function formatPartialDate(d: PartialDate, locale = "en-US"): string {
  if (!isValidPartialDate(d)) return "Unknown date";
  const fmt = (o: Intl.DateTimeFormatOptions, dt: Date) => new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(dt);
  switch (d.precision) {
    case "day":
      return fmt({ month: "short", day: "numeric", year: "numeric" }, new Date(Date.UTC(d.year!, d.month! - 1, d.day!)));
    case "month":
      return fmt({ month: "long", year: "numeric" }, new Date(Date.UTC(d.year!, d.month! - 1, 1)));
    case "year":
      return String(d.year);
    default:
      return "Unknown date";
  }
}

export function partialDateToIso(d: PartialDate): string | null {
  if (d.precision !== "day" || !isValidPartialDate(d)) return null;
  return DateTime.utc(d.year!, d.month!, d.day!).toISODate();
}

export function isValidTimezone(tz: string): boolean {
  return typeof tz === "string" && tz.length > 0 && DateTime.local().setZone(tz).isValid;
}

export function localDateIn(now: Date, tz: string): string {
  const iso = DateTime.fromJSDate(now, { zone: tz }).toISODate();
  if (!iso) throw new Error(`Invalid timezone: ${tz}`);
  return iso;
}

export function mondayOf(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate, { zone: "utc" });
  if (!dt.isValid) throw new Error(`Invalid date: ${isoDate}`);
  return dt.startOf("week").toISODate()!;
}

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: "utc" }).plus({ days }).toISODate()!;
}

export function formatInstant(iso: string, tz: string): string {
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);
  if (!dt.isValid) return "Unknown date";
  return dt.setLocale("en-US").toLocaleString({ ...DateTime.DATETIME_MED, timeZoneName: "short" });
}
