import type { EligibilityAssessment, JobFacts, UserProfile } from "./eligibility";
import { missingEvidence } from "./eligibility";
import type { Priority } from "./status";

export const SCORING_VERSION = "v1";

export const ROLE_CATEGORIES = [
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
  "non_technical",
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export const ADJACENT: Record<RoleCategory, readonly RoleCategory[]> = {
  software: ["backend", "frontend", "fullstack", "cloud", "devops", "data", "embedded", "security", "other_technical"],
  backend: ["software", "fullstack", "cloud", "devops", "data", "security"],
  frontend: ["software", "fullstack"],
  fullstack: ["software", "backend", "frontend", "cloud"],
  cloud: ["software", "backend", "devops", "security", "data"],
  data: ["software", "backend", "ai_ml", "cloud"],
  ai_ml: ["data", "software", "autonomous_robotics"],
  autonomous_robotics: ["ai_ml", "embedded", "software"],
  embedded: ["autonomous_robotics", "software", "security"],
  security: ["software", "backend", "cloud", "devops", "embedded"],
  devops: ["cloud", "backend", "software", "security"],
  other_technical: ["software"],
  non_technical: [],
};

export interface ScoreComponent {
  name: "role_interest" | "skills" | "graduation_degree" | "location" | "recency";
  points: number;
  max: number;
  explanation: string;
}

export interface ScoreResult {
  total: number;
  components: ScoreComponent[];
  recencyBasis: "source_posted" | "first_seen";
  missingEvidence: string[];
  priority: Priority;
  version: string;
}

const lc = (xs: string[]) => xs.map((x) => x.trim().toLowerCase());

function roleInterest(p: UserProfile, job: JobFacts): ScoreComponent {
  const base = { name: "role_interest", max: 30 } as const;
  const cat = job.role_category;
  if (!cat) return { ...base, points: 0, explanation: "Role category unknown (insufficient data)" };
  if (p.preferred_categories.length === 0) return { ...base, points: 0, explanation: "No preferred categories set (insufficient data)" };
  if (p.preferred_categories.includes(cat)) return { ...base, points: 30, explanation: `${cat} is one of your selected categories` };
  const adjacent = p.preferred_categories.some((c) => ADJACENT[c as RoleCategory]?.includes(cat as RoleCategory));
  return adjacent
    ? { ...base, points: 15, explanation: `${cat} is adjacent to your selected categories` }
    : { ...base, points: 0, explanation: `${cat} is not among or adjacent to your selected categories` };
}

function skills(p: UserProfile, job: JobFacts): ScoreComponent {
  const base = { name: "skills", max: 25 } as const;
  const required = job.requirements?.skills ?? [];
  if (required.length === 0) return { ...base, points: 0, explanation: "No skill requirements recorded (insufficient data)" };
  const mine = new Set(lc(p.confirmed_skills));
  const matched = lc(required).filter((s) => mine.has(s)).length;
  return {
    ...base,
    points: Math.round((matched / required.length) * 25),
    explanation: `${matched} of ${required.length} recorded skill requirements match your confirmed skills`,
  };
}

function graduationDegree(elig: EligibilityAssessment): ScoreComponent {
  const base = { name: "graduation_degree", max: 20 } as const;
  const outcome = (r: string) => elig.rules.find((x) => x.rule === r)?.outcome ?? "unknown";
  const g = outcome("graduation");
  const d = outcome("degree");
  if (g === "pass" && d === "pass") return { ...base, points: 20, explanation: "Graduation and degree both match" };
  if ((g === "pass" && d === "unknown") || (d === "pass" && g === "unknown")) {
    return { ...base, points: 10, explanation: `${g === "pass" ? "Graduation" : "Degree"} matches; the other is unknown` };
  }
  return { ...base, points: 0, explanation: "No confirmed graduation/degree match" };
}

function location(p: UserProfile, job: JobFacts): ScoreComponent {
  const base = { name: "location", max: 15 } as const;
  const prefLocs = lc(p.preferred_locations);
  const prefCountries = upperSet(p.preferred_countries);
  const jobLocs = lc(job.locations);
  const compatible =
    jobLocs.some((l) => prefLocs.some((x) => l.includes(x) || x.includes(l))) ||
    (job.country != null && prefCountries.has(job.country.toUpperCase()));
  if (compatible) return { ...base, points: 15, explanation: "Location matches your confirmed preferences" };
  if (job.country?.toUpperCase() === "US" && p.willing_to_relocate !== false) {
    return { ...base, points: 8, explanation: "US location; relocation needs review" };
  }
  return { ...base, points: 0, explanation: "Location unknown or not compatible with your preferences" };
}

const upperSet = (xs: string[]) => new Set(xs.map((x) => x.toUpperCase()));

function recency(job: JobFacts, now: Date): { c: ScoreComponent; basis: ScoreResult["recencyBasis"] } {
  const basis = job.source_posted_at ? "source_posted" : "first_seen";
  const label = basis === "source_posted" ? "source listing date" : "first seen date (not the employer posting date)";
  const stamp = job.source_posted_at ?? job.first_seen_at;
  const t = stamp ? Date.parse(stamp) : NaN;
  const base = { name: "recency", max: 10 } as const;
  if (Number.isNaN(t)) return { basis, c: { ...base, points: 0, explanation: `No ${label} available (insufficient data)` } };
  const days = Math.max(0, (now.getTime() - t) / 86_400_000);
  const points = days <= 7 ? 10 : days <= 30 ? 5 : 0;
  return { basis, c: { ...base, points, explanation: `Based on ${label}: ${Math.floor(days)} days ago` } };
}

export function scoreJob(profile: UserProfile, job: JobFacts, eligibility: EligibilityAssessment, now: Date): ScoreResult {
  const rec = recency(job, now);
  const components = [roleInterest(profile, job), skills(profile, job), graduationDegree(eligibility), location(profile, job), rec.c];
  const total = components.reduce((s, c) => s + c.points, 0);
  const strongInterest = components[0]!.points === 30;

  let priority: Priority = "low";
  if (eligibility.result !== "ineligible") {
    if (total >= 75 && eligibility.result === "eligible") priority = "high";
    else if (total >= 50 || (strongInterest && eligibility.result === "needs_review")) priority = "medium";
  }

  const missing = missingEvidence(eligibility);
  for (const c of components) {
    if (c.explanation.includes("insufficient data")) missing.push(c.explanation);
  }
  return { total, components, recencyBasis: rec.basis, missingEvidence: missing, priority, version: SCORING_VERSION };
}
