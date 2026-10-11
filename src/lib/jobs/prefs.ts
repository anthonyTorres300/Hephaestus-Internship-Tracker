export const JOB_PREFS_COOKIE = "icc_job_prefs";

export const ROLE_GROUPS = {
  swe: { label: "Software engineering", categories: ["software", "backend", "frontend", "fullstack"] },
  data_ai: { label: "Data and AI/ML", categories: ["data", "ai_ml"] },
  tech: {
    label: "Any technical role",
    categories: [
      "software",
      "backend",
      "frontend",
      "fullstack",
      "cloud",
      "data",
      "ai_ml",
      "autonomous_robotics",
      "embedded",
      "security",
      "devops",
      "other_technical",
    ],
  },
  all: { label: "Everything", categories: [] as string[] },
} as const;

export type RoleGroup = keyof typeof ROLE_GROUPS;

export interface JobPrefs {
  role: RoleGroup;
  undergradOnly: boolean;
}

export const DEFAULT_JOB_PREFS: JobPrefs = { role: "swe", undergradOnly: true };

export function parseJobPrefs(raw: string | undefined | null): JobPrefs {
  if (!raw) return DEFAULT_JOB_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<JobPrefs>;
    return {
      role: v.role && v.role in ROLE_GROUPS ? v.role : DEFAULT_JOB_PREFS.role,
      undergradOnly: typeof v.undergradOnly === "boolean" ? v.undergradOnly : true,
    };
  } catch {
    return DEFAULT_JOB_PREFS;
  }
}

const GRAD_TITLE =
  /\b(ph\.?\s?d|doctoral|doctorate|master'?s|masters|m\.?s\.?\s*(?:\/|or)\s*ph|graduate (?:student|program|intern|research))\b/i;

// True when a listing is aimed at graduate students (explicit requirement, or the title says so).
export function isGraduateOnly(job: { title: string; requirements?: Record<string, unknown> | null }): boolean {
  const req = (job.requirements ?? {}) as { graduate_only?: boolean; degree_levels?: string[] };
  if (req.graduate_only === true) return true;
  if (
    Array.isArray(req.degree_levels) &&
    req.degree_levels.length > 0 &&
    !req.degree_levels.some((d) => d === "bachelors" || d === "associate")
  )
    return true;
  return GRAD_TITLE.test(job.title);
}
