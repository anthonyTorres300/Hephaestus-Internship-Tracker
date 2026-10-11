export type DegreeLevel = "associate" | "bachelors" | "masters" | "phd";

export interface UserProfile {
  graduation_year: number | null;
  graduation_month: number | null;
  degree: DegreeLevel | "other" | null;
  work_authorization_country: string | null;
  work_authorized: boolean | null;
  requires_sponsorship: boolean | null;
  citizenship_countries: string[];
  citizenship_known: boolean;
  us_person: boolean | null;
  clearance_eligible: boolean | null;
  preferred_countries: string[];
  preferred_locations: string[];
  preferred_categories: string[];
  willing_to_relocate: boolean | null;
  remote_preference: "remote_only" | "hybrid_ok" | "onsite_ok" | "any" | null;
  confirmed_skills: string[];
  target_season: string | null;
  target_year: number | null;
}

export interface YearMonth {
  year: number;
  month: number;
}

export interface Evidence {
  text?: string;
  url?: string;
  date?: string;
}

export interface JobRequirements {
  graduation_from?: YearMonth;
  graduation_to?: YearMonth;
  degree_levels?: DegreeLevel[];
  graduate_only?: boolean;
  requires_citizenship?: string[];
  requires_us_person?: boolean;
  requires_clearance?: boolean;
  sponsorship_offered?: boolean;
  requires_visa_program?: string;
  remote_restricted_to?: string[];
  skills?: string[];
  evidence?: Evidence;
}

export interface JobFacts {
  company?: string;
  title?: string;
  role_category: string | null;
  season: string | null;
  season_year: number | null;
  locations: string[];
  country: string | null;
  work_mode: "onsite" | "hybrid" | "remote" | null;
  requirements: JobRequirements | null;
  source_posted_at?: string | null;
  first_seen_at?: string | null;
}

export type RuleName =
  | "graduation"
  | "degree"
  | "work_authorization"
  | "sponsorship"
  | "visa_program"
  | "citizenship"
  | "us_person"
  | "clearance"
  | "remote_jurisdiction";

export type Outcome = "pass" | "fail" | "unknown";

export interface RuleResult {
  rule: RuleName;
  outcome: Outcome;
  reason: string;
  evidence?: Evidence;
}

export type EligibilityResult = "eligible" | "ineligible" | "needs_review";

export interface EligibilityAssessment {
  result: EligibilityResult;
  rules: RuleResult[];
}

export const MISSING_EVIDENCE: Record<RuleName, string> = {
  graduation: "Graduation window required by the employer, or your graduation month",
  degree: "Degree level required by the employer, or your degree",
  work_authorization: "Your work authorization (and its country) for this job country",
  sponsorship: "Whether the employer offers sponsorship",
  visa_program: "Confirmation you are enrolled in the required visa/student program",
  citizenship: "Your citizenship, for the citizenship requirement",
  us_person: "Your US-person (export-control) status",
  clearance: "Your clearance eligibility",
  remote_jurisdiction: "Where you can work from, for the remote restriction",
};

const ym = (year: number, month: number) => year * 12 + month;
const fmtYm = (v: YearMonth) => `${v.year}-${String(v.month).padStart(2, "0")}`;
const upper = (xs: string[]) => xs.map((x) => x.toUpperCase());

function graduation(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  const { graduation_from: from, graduation_to: to } = req;
  if (!from && !to) return { outcome: "unknown", reason: "No graduation window recorded for this role" };
  if (p.graduation_year == null || p.graduation_month == null) {
    return { outcome: "unknown", reason: "Your graduation month is not set" };
  }
  const mine = ym(p.graduation_year, p.graduation_month);
  const label = fmtYm({ year: p.graduation_year, month: p.graduation_month });
  if (from && mine < ym(from.year, from.month)) {
    return { outcome: "fail", reason: `You graduate ${label}, before the required window starts ${fmtYm(from)}` };
  }
  if (to && mine > ym(to.year, to.month)) {
    return { outcome: "fail", reason: `You graduate ${label}, after the required window ends ${fmtYm(to)}` };
  }
  return { outcome: "pass", reason: `Graduation ${label} is inside the required window` };
}

function degree(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  const levels = req.degree_levels?.length ? req.degree_levels : null;
  if (!levels && !req.graduate_only) return { outcome: "unknown", reason: "No degree requirement recorded for this role" };
  if (!p.degree || p.degree === "other") return { outcome: "unknown", reason: "Your degree level is not set to a comparable value" };
  const outcomes: Outcome[] = [];
  if (req.graduate_only) outcomes.push(p.degree === "masters" || p.degree === "phd" ? "pass" : "fail");
  if (levels) outcomes.push(levels.includes(p.degree) ? "pass" : "fail");
  if (outcomes.includes("fail")) {
    return {
      outcome: "fail",
      reason:
        req.graduate_only && p.degree !== "masters" && p.degree !== "phd"
          ? `Graduate-only role; your degree is ${p.degree}`
          : `Role requires ${levels!.join("/")}; your degree is ${p.degree}`,
    };
  }
  return { outcome: "pass", reason: `Your ${p.degree} degree matches the requirement` };
}

function workAuthorization(p: UserProfile, job: JobFacts, req: JobRequirements): Omit<RuleResult, "rule"> {
  if (!job.country) return { outcome: "unknown", reason: "Job country is unknown" };
  if (p.work_authorized == null || !p.work_authorization_country) {
    return { outcome: "unknown", reason: "Your work authorization country/status is not set" };
  }
  if (p.work_authorization_country.toUpperCase() !== job.country.toUpperCase()) {
    return {
      outcome: "unknown",
      reason: `Your authorization is for ${p.work_authorization_country}, which does not transfer to ${job.country}`,
    };
  }
  if (p.work_authorized) return { outcome: "pass", reason: `Authorized to work in ${job.country}` };
  if (req.sponsorship_offered === true) return { outcome: "pass", reason: "Not yet authorized, but employer offers sponsorship" };
  if (req.sponsorship_offered === false) return { outcome: "fail", reason: "Not authorized and employer does not sponsor" };
  return { outcome: "unknown", reason: "Not authorized; sponsorship availability unknown" };
}

function sponsorship(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  if (p.requires_sponsorship == null) return { outcome: "unknown", reason: "Whether you need sponsorship is not set" };
  if (!p.requires_sponsorship) return { outcome: "pass", reason: "You do not need sponsorship" };
  if (req.sponsorship_offered === true) return { outcome: "pass", reason: "You need sponsorship and the employer offers it" };
  if (req.sponsorship_offered === false) return { outcome: "fail", reason: "You need sponsorship and the employer does not offer it" };
  return { outcome: "unknown", reason: "You need sponsorship; employer sponsorship is not recorded" };
}

function visaProgram(req: JobRequirements): Omit<RuleResult, "rule"> {
  if (!req.requires_visa_program) return { outcome: "pass", reason: "No specific visa/student program required" };
  return { outcome: "unknown", reason: `Role requires the ${req.requires_visa_program} program; confirm it applies to you` };
}

function citizenship(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  const need = req.requires_citizenship;
  if (!need?.length) return { outcome: "pass", reason: "No citizenship requirement recorded" };
  if (!p.citizenship_known) return { outcome: "unknown", reason: `Requires citizenship of ${need.join("/")}; yours is not set` };
  const mine = upper(p.citizenship_countries);
  return upper(need).some((c) => mine.includes(c))
    ? { outcome: "pass", reason: "Your citizenship satisfies the requirement" }
    : { outcome: "fail", reason: `Requires citizenship of ${need.join("/")}` };
}

function usPerson(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  if (!req.requires_us_person) return { outcome: "pass", reason: "No US-person requirement recorded" };
  if (p.us_person == null) return { outcome: "unknown", reason: "US-person status is not set" };
  return p.us_person ? { outcome: "pass", reason: "You are a US person" } : { outcome: "fail", reason: "Role requires US-person status" };
}

function clearance(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  if (!req.requires_clearance) return { outcome: "pass", reason: "No clearance requirement recorded" };
  if (p.clearance_eligible == null) return { outcome: "unknown", reason: "Clearance eligibility is not set" };
  return p.clearance_eligible
    ? { outcome: "pass", reason: "You are clearance eligible" }
    : { outcome: "fail", reason: "Role requires clearance eligibility" };
}

function remoteJurisdiction(p: UserProfile, req: JobRequirements): Omit<RuleResult, "rule"> {
  const allowed = req.remote_restricted_to;
  if (!allowed?.length) return { outcome: "pass", reason: "No remote jurisdiction restriction recorded" };
  const mine = new Set(
    upper([
      ...(p.work_authorization_country ? [p.work_authorization_country] : []),
      ...(p.citizenship_known ? p.citizenship_countries : []),
    ]),
  );
  if (mine.size === 0)
    return { outcome: "unknown", reason: `Remote only from ${allowed.join(", ")}; your location/authorization is not set` };
  const matches = upper(allowed).filter((a) => mine.has(a.split("-")[0]!));
  if (matches.length === 0) return { outcome: "fail", reason: `Remote only from ${allowed.join(", ")}` };
  if (matches.every((m) => m.includes("-"))) {
    return { outcome: "unknown", reason: `Remote restricted to ${matches.join(", ")}; confirm your location qualifies` };
  }
  return { outcome: "pass", reason: `Remote jurisdiction ${matches.join(", ")} includes you` };
}

export function assessEligibility(profile: UserProfile, job: JobFacts): EligibilityAssessment {
  const req = job.requirements ?? {};
  const evidence = req.evidence;
  const rules: RuleResult[] = (
    [
      ["graduation", graduation(profile, req)],
      ["degree", degree(profile, req)],
      ["work_authorization", workAuthorization(profile, job, req)],
      ["sponsorship", sponsorship(profile, req)],
      ["visa_program", visaProgram(req)],
      ["citizenship", citizenship(profile, req)],
      ["us_person", usPerson(profile, req)],
      ["clearance", clearance(profile, req)],
      ["remote_jurisdiction", remoteJurisdiction(profile, req)],
    ] as const
  ).map(([rule, r]) => ({ rule, ...r, ...(evidence && r.outcome !== "unknown" ? { evidence } : {}) }));

  const result: EligibilityResult = rules.some((r) => r.outcome === "fail")
    ? "ineligible"
    : rules.every((r) => r.outcome === "pass")
      ? "eligible"
      : "needs_review";
  return { result, rules };
}

export const isDefaultFeedVisible = (result: EligibilityResult): boolean => result !== "ineligible";

export const missingEvidence = (a: EligibilityAssessment): string[] =>
  a.rules.filter((r) => r.outcome === "unknown").map((r) => MISSING_EVIDENCE[r.rule]);
