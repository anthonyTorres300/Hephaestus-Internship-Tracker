import { describe, expect, it } from "vitest";
import {
  countsReconcile,
  fileHash,
  fingerprintRow,
  identityKey,
  mapColumns,
  parseTable,
  PROPOSED_KEYS,
  stageRows,
  summarizeStaged,
  type StageOptions,
} from "@/lib/import";
import { MESSY_CSV, TEMPLATE_CSV } from "../fixtures/import/generate";

const HDR = "Company Name,Position Applied For,Application Date,Status,Interview Date,Offer Received,To Check Progress\n";
const NOW = "2026-10-10T00:00:00Z";
const stage = (csv: string, extra: Partial<StageOptions> = {}) => {
  const t = parseTable(csv);
  return stageRows(t, { columnMap: mapColumns(t.headers), nowIso: NOW, ...extra });
};
// insert_application keys (supabase/migrations/20261010000004_rpcs.sql) plus offer/interview sub-objects
const ALLOWED = new Set([
  "company_name",
  "role_title",
  "status",
  "attested",
  "submitted_precision",
  "submitted_year",
  "submitted_month",
  "submitted_day",
  "submission_date_unknown",
  "original_status",
  "original_application_date",
  "contact_channel",
  "portal_url",
  "application_url",
  "season",
  "season_year",
  "role_category",
  "priority",
  "offer",
  "interview",
]);

describe("stageRows", () => {
  it("stages the template", () => {
    const r = stage(TEMPLATE_CSV);
    expect(r).toHaveLength(3);
    expect(r[0].proposed).toMatchObject({
      company_name: "Northwind Aerospace",
      status: "applied",
      attested: true,
      submitted_precision: "day",
      submitted_year: 2025,
      submitted_month: 8,
      submitted_day: 26,
      original_status: "Pending",
      original_application_date: "Aug.26.25",
      contact_channel: "Email",
      season: "summer",
      season_year: 2027,
      role_category: "internship",
    });
    expect(r[0].proposed.portal_url).toBeUndefined();
    expect(r[1].proposed).toMatchObject({
      submitted_precision: "month",
      submitted_year: 2024,
      submitted_month: 9,
      role_category: "early_career",
      portal_url: "https://careers.example.com/portal/abc",
    });
    expect(r[1].proposed.submitted_day).toBeUndefined();
    expect(r[1].proposed.season).toBeUndefined();
    expect(r[1].proposed.interview).toMatchObject({ precision: "day", year: 2025, month: 10, day: 8, raw: "Oct 8.25" });
    expect(r.every((x) => x.errors.length === 0)).toBe(true);
  });
  it("every proposed key is allowed by insert_application", () => {
    for (const row of [...stage(TEMPLATE_CSV), ...stage(MESSY_CSV)]) {
      for (const k of Object.keys(row.proposed)) expect(ALLOWED.has(k), k).toBe(true);
    }
    for (const k of PROPOSED_KEYS) expect(ALLOWED.has(k)).toBe(true);
  });
  it("Offer Received yes/no needs review without a date; blank gives no offer; blank interview none", () => {
    const r = stage(TEMPLATE_CSV);
    expect(r[2].proposed.offer).toEqual({ precision: "unknown", raw: "Yes", needs_review: true });
    expect(r[0].proposed.offer).toBeUndefined();
    expect(r[0].proposed.interview).toBeUndefined();
    const d = stage(HDR + "Contoso Labs,Intern,2025-08-26,Offer Received,,Sept. 2025,\n");
    expect(d[0].proposed.offer).toMatchObject({ precision: "month", year: 2025, month: 9, needs_review: false });
  });
  it("season only from explicit title evidence", () => {
    const r = stage(
      HDR + "A Co,Engineer,2025-08-26,Pending,,,\nB Co,Winter 2025 Intern,2025-08-26,Pending,,,\nC Co,Fall '26 Co-op,Jan.5.25,Pending,,,\n",
    );
    expect(r[0].proposed.season).toBeUndefined();
    expect(r[0].proposed.season_year).toBeUndefined();
    expect(r[1].proposed).toMatchObject({ season: "winter", season_year: 2025 });
    expect(r[2].proposed).toMatchObject({ season: "fall", season_year: 2026, role_category: "co-op" });
  });
  it("repeated company + portal rows are retained separately; identical rows get blocking warning", () => {
    const row = "Contoso Labs,Backend Intern,Aug.26.25,Pending,,,https://careers.example.com/p/1\n";
    const r = stage(HDR + row + "Contoso Labs,Data Intern,Aug.26.25,Pending,,,https://careers.example.com/p/1\n" + row);
    expect(r).toHaveLength(3);
    expect(r[1].warnings.map((w) => w.code)).toContain("portal_url_reused");
    expect(r[1].warnings.find((w) => w.code === "portal_url_reused")?.blocking).toBeUndefined();
    expect(r[2].warnings.find((w) => w.code === "repeated_source_row")).toMatchObject({ blocking: true, first_ordinal: 1 });
    expect(r[0].warnings.some((w) => w.code === "repeated_source_row")).toBe(false);
    expect(r[0].fingerprint).toBe(r[2].fingerprint);
    expect(r[0].fingerprint).not.toBe(r[1].fingerprint);
  });
  it("errors: missing fields, ambiguous, invalid, unmapped status", () => {
    const r = stage(
      HDR +
        ",Intern,2025-08-26,Pending,,,\nA Co,,2025-08-26,Pending,,,\nB Co,Intern,03/04/25,Pending,,,\nC Co,Intern,Feb.30.25,Pending,,,\nD Co,Intern,2025-08-26,On Hold,,,\n",
    );
    expect(r.map((x) => x.errors.map((e) => e.code))).toEqual([
      ["missing_company"],
      ["missing_role"],
      ["ambiguous_date"],
      ["invalid_date"],
      ["unmapped_status"],
    ]);
    expect(summarizeStaged(r).commitReady).toBe(false);
  });
  it("overrides resolve ambiguous dates; status map resolves labels", () => {
    const t = parseTable(HDR + "B Co,Intern,03/04/25,On Hold,,,\n");
    const r = stageRows(t, {
      columnMap: mapColumns(t.headers),
      nowIso: NOW,
      statusMap: { "on hold": "withdrawn" },
      overrides: { 1: { application_date: "2025-03-04" } },
    });
    expect(r[0].errors).toEqual([]);
    expect(r[0].proposed).toMatchObject({ status: "withdrawn", submitted_day: 4, original_application_date: "03/04/25" });
  });
  it("blank submitted date sets unknown; Not Proceeding keeps reason and original label", () => {
    const r = stage(HDR + "A Co,Intern,,Not Proceeding,,,\n");
    expect(r[0].proposed).toMatchObject({
      status: "rejected",
      submission_date_unknown: true,
      submitted_precision: "unknown",
      original_status: "Not Proceeding",
    });
    expect(r[0].statusReason).toBe("imported source label");
  });
  it("attestSubmitted false clears attestation", () => {
    expect(stage(HDR + "A Co,Intern,2025-08-26,Pending,,,\n", { attestSubmitted: false })[0].proposed.attested).toBe(false);
  });
  it("suspicious dates and date order are blocking warnings, values kept", () => {
    const r = stage(HDR + "A Co,Intern,Jan.21.14,Pending,Jan.1.14,,\nB Co,Intern,Aug.26.25,Pending,Aug.1.25,,\n");
    expect(r[0].warnings.find((w) => w.code === "suspicious_date")).toMatchObject({ blocking: true });
    expect(r[0].proposed.submitted_year).toBe(2014);
    expect(r[1].warnings.map((w) => w.code)).toContain("date_order");
  });
  it("possible duplicate vs existing is blocking warning only; confirmed identity is stronger", () => {
    const ex = [
      {
        id: "e1",
        company_name: "Contoso Labs",
        role_title: "Backend  Intern",
        submitted_precision: "day",
        submitted_year: 2025,
        submitted_month: 8,
        submitted_day: 26,
      },
      { id: "e2", company_name: "Other", role_title: "Other", confirmed_identity: identityKey("Fabrikam Systems", "Data Intern") },
    ];
    const r = stage(
      HDR +
        "contoso labs,backend intern,Aug.26.25,Pending,,,\nContoso Labs,Backend Intern,Aug.27.25,Pending,,,\nFabrikam Systems,Data Intern,Aug.1.25,Pending,,,\n",
      { existing: ex },
    );
    expect(r[0].warnings[0]).toMatchObject({ code: "possible_duplicate", blocking: true, existing_id: "e1" });
    expect(r[0].errors).toEqual([]);
    expect(r[1].warnings).toEqual([]);
    expect(r[2].warnings[0].code).toBe("confirmed_identity_match");
  });
  it("count reconciliation drops wholly blank rows", () => {
    const r = stage(MESSY_CSV);
    expect(r.map((x) => x.ordinal)).toEqual([1, 2, 3]);
    expect(r[0].proposed.contact_channel).toBe("Check portal\nweekly");
    const s = summarizeStaged(r);
    expect(s.nonblank).toBe(3);
    expect(countsReconcile({ created: 1, linked: 0, skipped: 1, failed: 1 }, s.nonblank)).toBe(true);
    expect(countsReconcile({ created: 1, linked: 0, skipped: 0, failed: 1 }, s.nonblank)).toBe(false);
  });
  it("round-trips the app-native export", async () => {
    const { applicationsToCsv } = await import("@/lib/export");
    const csv = applicationsToCsv(
      [
        {
          company_name: "Northwind Aerospace",
          role_title: "Intern",
          status: "applied",
          original_status: "Pending",
          submitted_precision: "month",
          submitted_year: 2024,
          submitted_month: 9,
          original_application_date: "Sept. 2024",
        },
      ],
      { now: new Date(NOW) },
    );
    const r = stage(csv);
    expect(r[0].errors).toEqual([]);
    expect(r[0].proposed).toMatchObject({
      status: "applied",
      original_status: "Pending",
      submitted_precision: "month",
      submitted_year: 2024,
      submitted_month: 9,
      original_application_date: "Sept. 2024",
    });
  });
});

describe("hashing", () => {
  it("sha-256 matches known vectors", () => {
    expect(fileHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(fileHash("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(fileHash(new Uint8Array(1000).fill(97))).toHaveLength(64);
  });
  it("fingerprint ignores whitespace noise", () => {
    expect(fingerprintRow({ a: " x  y " })).toBe(fingerprintRow({ a: "x y" }));
  });
});
