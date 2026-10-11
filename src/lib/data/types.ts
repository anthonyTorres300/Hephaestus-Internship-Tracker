import type { Status } from "@/lib/domain";

export type Priority = "high" | "medium" | "low";
export type Season = "summer" | "fall" | "winter" | "spring";

export interface Profile {
  user_id: string;
  university: string | null;
  degree: "associate" | "bachelors" | "masters" | "phd" | "other" | null;
  graduation_year: number | null;
  graduation_month: number | null;
  timezone: string;
  timezone_confirmed: boolean;
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
  starred_companies: string[];
  weekly_practice_goal: number;
  target_season: Season;
  target_year: number;
  preferred_language: string;
  onboarding_state: "not_started" | "in_progress" | "complete";
  profile_revision: number;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string | null;
  company_name: string;
  role_title: string;
  requisition_id: string | null;
  application_url: string | null;
  portal_url: string | null;
  locations: unknown;
  work_mode: string | null;
  role_category: string | null;
  season: Season | null;
  season_year: number | null;
  priority: Priority;
  status: Status;
  submitted_year: number | null;
  submitted_month: number | null;
  submitted_day: number | null;
  submitted_precision: "day" | "month" | "year" | "unknown";
  submission_date_unknown: boolean;
  submission_attested: boolean;
  original_status: string | null;
  original_application_date: string | null;
  contact_channel: string | null;
  confirmed_identity: string | null;
  resume_version_id: string | null;
  import_batch_id: string | null;
  archived_at: string | null;
  trashed_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface StatusEvent {
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  effective_at: string | null;
  effective_at_unknown: boolean;
  recorded_at: string;
  origin: string;
  reason: string | null;
}

export interface Note {
  id: string;
  application_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewEvent {
  id: string;
  application_id: string;
  round_number: number;
  round_type: string | null;
  scheduled_at: string | null;
  event_year: number | null;
  event_month: number | null;
  event_day: number | null;
  date_precision: "day" | "month" | "year" | "unknown" | "timestamp";
  timezone: string | null;
  outcome: string;
  notes: string | null;
  raw_value: string | null;
  origin: string;
}

export interface OfferEvent {
  id: string;
  application_id: string;
  received_year: number | null;
  received_month: number | null;
  received_day: number | null;
  date_precision: "day" | "month" | "year" | "unknown";
  date_unknown: boolean;
  raw_value: string | null;
  needs_review: boolean;
}

export interface Task {
  id: string;
  application_id: string | null;
  job_id: string | null;
  kind: "application_deadline" | "follow_up" | "offer_deadline" | "review";
  due_date: string | null;
  due_at: string | null;
  timezone: string | null;
  state: "pending" | "completed" | "dismissed";
  source: "user" | "source_claim";
  evidence: string | null;
  note: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  company: string;
  title: string;
  role_category: string | null;
  season: Season | null;
  season_year: number | null;
  locations: string[];
  country: string | null;
  work_mode: string | null;
  apply_url: string | null;
  canonical_url: string | null;
  requirements: Record<string, unknown>;
  source_posted_year: number | null;
  source_posted_month: number | null;
  source_posted_day: number | null;
  source_posted_precision: "day" | "month" | "year" | "unknown";
  identity_key: string | null;
  first_seen_at: string;
  last_seen_at: string;
  availability: "listed" | "source_closed" | "missing_from_source" | "unknown";
}

export interface UserJob {
  id: string;
  job_id: string;
  saved: boolean;
  hidden: boolean;
  verification_state: "none" | "open" | "closed";
  verification_url: string | null;
  verification_note: string | null;
  verified_at: string | null;
}

export interface ResumeVersion {
  id: string;
  version_number: number;
  label: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  source_link: string | null;
  source_date: string | null;
  role_tags: string[];
  notes: string | null;
  state: "pending_upload" | "ready" | "delete_pending" | "failed";
  created_at: string;
}

export interface PracticeProblem {
  id: string;
  platform: "leetcode";
  platform_id: string | null;
  slug: string | null;
  url: string | null;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "unknown";
}

export interface PracticeAttempt {
  id: string;
  problem_id: string;
  practiced_at: string;
  duration_minutes: number | null;
  duration_unknown: boolean;
  language: string | null;
  result: "solved_independently" | "solved_with_hints" | "reviewed_solution" | "unsolved";
  confidence: number | null;
  notes: string | null;
  next_review_date: string | null;
}

export interface DsaTopic {
  id: number;
  slug: string;
  title: string;
  sort_order: number;
}
