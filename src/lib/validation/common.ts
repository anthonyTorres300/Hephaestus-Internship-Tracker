import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(72, "Use 72 characters or fewer.");

export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => /^https?:\/\//i.test(u), "Use an http(s) link.")
  .refine((u) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid link.");
export const optionalUrl = z.preprocess((v) => (v === "" || v == null ? undefined : v), safeUrl.optional());
export const httpsUrl = safeUrl.refine((u) => u.toLowerCase().startsWith("https://"), "Use an https link.");

export const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
export const reqText = (max: number, label = "This field") => z.string().trim().min(1, `${label} is required.`).max(max);

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const optInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(min).max(max).optional());

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Use a valid date.");
export const optIsoDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), isoDate.optional());

export function formToObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

export function fieldErrors(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_";
    (out[k] ??= []).push(issue.message);
  }
  return out;
}

export function stringValues(o: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === "string" && !/password/i.test(k)) out[k] = v;
  return out;
}

export const splitList = (s: string | undefined, max = 50): string[] =>
  (s ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
