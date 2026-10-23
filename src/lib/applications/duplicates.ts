import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/data/export";
import { canonicalizeUrl } from "@/lib/discovery/identity";
import type { ApplicationDuplicate } from "./types";
type Candidate = { company_name?: string; requisition_id?: string; application_url?: string; job_id?: string };
type Existing = ApplicationDuplicate & {
  application_url: string | null;
  requisition_id: string | null;
  job_id: string | null;
  trashed_at: string | null;
};
const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export function duplicateApplications(rows: readonly Existing[], candidate: Candidate): ApplicationDuplicate[] {
  const url = candidate.application_url ? canonicalizeUrl(candidate.application_url) : null;
  return rows
    .filter((row) => !row.trashed_at)
    .flatMap((row) => {
      const reason =
        candidate.job_id && candidate.job_id === row.job_id
          ? "Same job listing"
          : url && row.application_url && url === canonicalizeUrl(row.application_url)
            ? "Same application link"
            : norm(candidate.company_name) &&
                norm(candidate.requisition_id) &&
                norm(candidate.company_name) === norm(row.company_name) &&
                norm(candidate.requisition_id) === norm(row.requisition_id)
              ? "Same company and requisition ID"
              : null;
      return reason ? [{ id: row.id, company_name: row.company_name, role_title: row.role_title, status: row.status, reason }] : [];
    })
    .slice(0, 5);
}
export async function findApplicationDuplicates(supabase: SupabaseClient, candidate: Candidate) {
  const rows = await fetchAll<Existing>(
    supabase,
    "applications",
    "id",
    "id,company_name,role_title,status,application_url,requisition_id,job_id,trashed_at",
  );
  return duplicateApplications(rows, candidate);
}
