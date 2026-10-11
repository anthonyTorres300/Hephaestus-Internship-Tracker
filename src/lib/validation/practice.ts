import { z } from "zod";
import { checkbox, optInt, optText } from "./common";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const LONG_DURATION = 180;

export const attemptSchema = z
  .object({
    title: z.string().trim().min(1, "Enter the problem title.").max(200),
    url: z.preprocess(
      emptyToUndef,
      z
        .string()
        .trim()
        .max(500)
        .url("Enter a valid link.")
        .refine((u) => u.startsWith("https://"), "Use an https link.")
        .optional(),
    ),
    difficulty: z.enum(["easy", "medium", "hard", "unknown"]).default("unknown"),
    topic_ids: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.coerce.number().int().positive()).max(15)),
    practiced_local: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Choose when you practiced."),
    result: z.enum(["solved_independently", "solved_with_hints", "reviewed_solution", "unsolved"], { message: "Choose a result." }),
    duration_minutes: optInt(0, 240),
    duration_unknown: checkbox,
    confirm_long: checkbox,
    language: optText(40),
    confidence: optInt(1, 5),
    notes: optText(5000),
    next_review_date: z.preprocess(
      emptyToUndef,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.duration_minutes != null && v.duration_unknown)
      ctx.addIssue({ code: "custom", path: ["duration_minutes"], message: "Enter minutes or mark the duration unknown, not both." });
    if (v.duration_minutes != null && v.duration_minutes > LONG_DURATION && !v.confirm_long)
      ctx.addIssue({
        code: "custom",
        path: ["duration_minutes"],
        message: `That is over ${LONG_DURATION} minutes. Tick the box to confirm it is correct.`,
      });
  });

// LeetCode problem links look like https://leetcode.com/problems/two-sum/ ; the slug identifies the problem.
export function leetcodeSlug(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)leetcode\.(com|cn)$/.test(u.hostname)) return null;
    const m = /^\/problems\/([a-z0-9-]+)/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
