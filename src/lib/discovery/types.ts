import type { Requirements, Season, WorkMode } from "./normalize";

export interface SourcePosted {
  year: number | null;
  month: number | null;
  day: number | null;
  precision: "day" | "month" | "year" | "unknown";
}

export interface SnapshotRow {
  entry_key: string;
  permalink: string;
  row_hash: string;
  company: string;
  title: string;
  role_category: string;
  season: Season | null;
  season_year: number | null;
  locations: string[];
  country: string | null;
  work_mode: WorkMode;
  apply_url: string | null;
  canonical_url: string | null;
  identity_key: string | null;
  candidate_key: string;
  ats_namespace: string | null;
  employer_namespace: string | null;
  requisition_id: string | null;
  normalization_version: string;
  requirements: Requirements;
  source_posted: SourcePosted;
  state: "listed" | "source_closed";
  alternate_urls: string[];
  section: string | null;
  listing_text: string | null;
  listing_kind: "age" | "date" | null;
  /** Present only when apply_url is the list's own redirector rather than an employer/ATS page (no identity is derived from it). */
  link_kind?: "source_redirect";
}

export interface Quarantine {
  line: number;
  code: string;
  section?: string;
}

export interface AdapterContext {
  owner: string;
  repo: string;
  path: string;
  commitSha: string;
}

export interface AdapterResult {
  rows: SnapshotRow[];
  quarantined: Quarantine[];
  complete: boolean;
  errorCode?: string;
  stats: Record<string, number>;
}

export interface Adapter {
  id: string;
  version: string;
  parse(text: string, ctx: AdapterContext): AdapterResult;
}

export class DiscoveryError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DiscoveryError";
  }
}

export const errorCode = (e: unknown): string => {
  if (e instanceof DiscoveryError) return e.code;
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" && /^[A-Z0-9]{5}$/.test(c) ? `db_error_${c}` : "unexpected_error";
};
