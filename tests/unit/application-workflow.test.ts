import { applicationOperationKey } from "@/lib/applications/operation-key";
import { describe, expect, it } from "vitest";
import { duplicateApplications } from "@/lib/applications/duplicates";
import { draftFields, restoreInitial, continuingInitial, readApplicationDraft } from "@/lib/applications/drafts";
import { extractJobSuggestion } from "@/lib/applications/job-prefill";
import { isPublicAddress, publicPageUrl } from "@/lib/server/public-page";
const row = {
  id: "one",
  company_name: "Example Corp",
  role_title: "SWE Intern",
  status: "applied",
  reason: "",
  application_url: "https://jobs.example.com/jobs/123?utm_source=newsletter",
  requisition_id: "R-42",
  job_id: null,
  trashed_at: null,
};

describe("application duplicate detection", () => {
  it("matches posting URLs while preserving job identity parameters", () => {
    expect(duplicateApplications([row], { application_url: "https://jobs.example.com/jobs/123#apply" })[0]?.reason).toBe(
      "Same application link",
    );
    expect(
      duplicateApplications([{ ...row, application_url: "https://jobs.example.com/job?job_id=1" }], {
        application_url: "https://jobs.example.com/job?job_id=2",
      }),
    ).toEqual([]);
  });
  it("matches requisitions within a company, without warning for unrelated roles or companies", () => {
    expect(duplicateApplications([row], { company_name: " example  CORP ", requisition_id: " r-42 " })[0]?.id).toBe("one");
    expect(duplicateApplications([row], { company_name: "Other", requisition_id: "R-42" })).toEqual([]);
    expect(duplicateApplications([row], { company_name: "Example Corp" })).toEqual([]);
  });
  it("matches shared listing IDs, skips trashed records and bounds the displayed results", () => {
    const existing = { ...row, job_id: "listing" };
    expect(duplicateApplications([existing], { job_id: "listing" })[0]?.reason).toBe("Same job listing");
    expect(duplicateApplications([{ ...existing, trashed_at: "2026-10-13" }], { job_id: "listing" })).toEqual([]);
    expect(
      duplicateApplications(
        Array.from({ length: 8 }, (_, i) => ({ ...existing, id: String(i) })),
        { job_id: "listing" },
      ),
    ).toHaveLength(5);
  });
});

describe("application drafts and batch entry", () => {
  function form(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    return fd;
  }
  it("retains season and date while clearing the identity of the previously logged job", () => {
    const next = continuingInitial(
      form({
        company_name: "Example",
        role_title: "SWE",
        application_url: row.application_url!,
        job_id: "old",
        requisition_id: "old",
        season: "summer",
        season_year: "2027",
        date_known: "day",
        submitted_day: "2026-10-09",
      }),
    );
    expect(next).toMatchObject({
      status: "applied",
      season: "summer",
      season_year: 2027,
      submitted_year: 2026,
      submitted_month: 10,
      submitted_day: 9,
    });
    expect(next.company_name).toBeUndefined();
    expect(next.application_url).toBeUndefined();
    expect(next.job_id).toBeUndefined();
  });
  it("restores month-only, unknown and incomplete dates without inventing a date", () => {
    expect(restoreInitial({ date_known: "month", submitted_month: "2026-09" })).toMatchObject({
      submitted_precision: "month",
      submitted_year: 2026,
      submitted_month: 9,
    });
    expect(restoreInitial({ date_known: "unknown" })).toMatchObject({ submission_date_unknown: true });
    expect(restoreInitial({ date_known: "month", submitted_month: "" })).toMatchObject({
      submitted_precision: "month",
      submitted_year: null,
    });
  });
  it("excludes operation metadata and duplicate confirmation from field snapshots", () => {
    expect(
      draftFields(
        form({ company_name: "Example", idem: "token", allow_duplicate: "on", attested: "on", intent: "another", password: "never" }),
      ),
    ).toEqual({ company_name: "Example" });
  });
  it("rejects stale or corrupt drafts and uses only known string fields", () => {
    const now = Date.now();
    const storage = (value: unknown) => ({ getItem: () => JSON.stringify(value) });
    const value = {
      version: 1,
      savedAt: now,
      idem: "operation-key",
      fields: { company_name: "Example", password: "ignored", role_title: 42 },
    };
    expect(readApplicationDraft(storage(value), "owner-key", now)).toEqual({ idem: "operation-key", fields: { company_name: "Example" } });
    expect(readApplicationDraft(storage({ ...value, savedAt: now - 8 * 86400000 }), "owner-key", now)).toBeNull();
    expect(readApplicationDraft({ getItem: () => "bad JSON" }, "owner-key", now)).toBeNull();
  });
});

describe("public posting suggestions", () => {
  it("extracts bounded facts from JobPosting structured data inside a graph", () => {
    const data = {
      "@graph": [
        {
          "@type": "JobPosting",
          title: "Backend Intern",
          hiringOrganization: { name: "Example &amp; Co" },
          identifier: { value: "REQ-77" },
          jobLocation: [{ address: { addressLocality: "San Juan", addressRegion: "PR", addressCountry: "US" } }],
        },
      ],
    };
    expect(
      extractJobSuggestion(`<script type="application/ld+json">${JSON.stringify(data)}</script>`, "https://example.com/jobs/backend"),
    ).toEqual({ company_name: "Example & Co", role_title: "Backend Intern", locations: ["San Juan, PR, US"], requisition_id: "REQ-77" });
  });
  it("handles remote jobs and malformed JSON without executing scripts or guessing a requisition from a title slug", () => {
    expect(
      extractJobSuggestion(
        '<script type="application/ld+json">{"@type":"JobPosting","title":"Remote Intern","jobLocationType":"TELECOMMUTE"}</script>',
        "https://example.com/jobs/backend-intern",
      ),
    ).toMatchObject({ locations: ["Remote"], requisition_id: undefined });
    expect(
      extractJobSuggestion(
        '<script type="application/ld+json">broken</script><meta property="og:title" content="SWE &amp; Data"><meta property="og:site_name" content="Example">',
        "https://example.com/job?gh_jid=12345",
      ),
    ).toMatchObject({ role_title: "SWE & Data", company_name: "Example", requisition_id: "12345" });
  });
  it("blocks private, transition and reserved addresses before outbound previews", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.31.1.1",
      "169.254.169.254",
      "192.168.0.1",
      "100.64.1.1",
      "198.18.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "2002:7f00:1::1",
    ])
      expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    for (const url of [
      "http://example.com/job",
      "https://localhost/job",
      "https://2130706433/job",
      "https://example.com:8443/job",
      "https://user:secret@example.com/job",
      "https://metadata.google.internal/",
    ])
      expect(() => publicPageUrl(url)).toThrow();
    expect(publicPageUrl("https://jobs.example.com/job/123").hostname).toBe("jobs.example.com");
  });
});

describe("retry identity for application drafts", () => {
  it("reuses an operation for identical retries and gives edited or explicitly separate applications a new operation", async () => {
    const fd = new FormData();
    fd.set("idem", "stable-draft-nonce");
    fd.set("company_name", "Example");
    fd.set("role_title", "SWE Intern");
    const original = await applicationOperationKey(fd);
    expect(original.length).toBeLessThanOrEqual(128);
    fd.set("intent", "another");
    expect(await applicationOperationKey(fd)).toBe(original);
    fd.set("role_title", "Data Intern");
    expect(await applicationOperationKey(fd)).not.toBe(original);
    fd.set("role_title", "SWE Intern");
    fd.set("allow_duplicate", "on");
    expect(await applicationOperationKey(fd)).not.toBe(original);
    fd.delete("allow_duplicate");
    fd.set("idem", "next-draft-nonce");
    expect(await applicationOperationKey(fd)).not.toBe(original);
  });
});
