import { describe, expect, it } from "vitest";
import { applicationsToCsv, escapeCsvCell, exportFilename, ExportOwnershipError, ownerExportJson, toCsv } from "@/lib/export";

describe("escapeCsvCell", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+1", "'+1"],
    ["-1+1", "'-1+1"],
    ["@SUM(A1)", "'@SUM(A1)"],
    [" =1+1", "' =1+1"],
    ["\t=cmd", "'\t=cmd"],
    ["\r=cmd", '"\'\r=cmd"'],
    ["​=cmd", "'​=cmd"],
    ["plain", "plain"],
    ["a-b", "a-b"],
    ["", ""],
  ])("%j", (input, out) => expect(escapeCsvCell(input)).toBe(out));
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(escapeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(escapeCsvCell("=A,B")).toBe(`"'=A,B"`);
  });
  it("toCsv joins with CRLF and optional BOM", () => {
    expect(toCsv(["a", "b"], [["1", "=x"]])).toBe("a,b\r\n1,'=x\r\n");
    expect(toCsv(["a"], [], { bom: true }).startsWith("﻿")).toBe(true);
  });
});

describe("builders", () => {
  const now = new Date("2026-10-10T12:34:56Z");
  it("renders precision rules and escapes formulas", () => {
    const csv = applicationsToCsv(
      [
        {
          id: "1",
          company_name: "=HYPERLINK()",
          role_title: "Intern",
          status: "applied",
          submitted_precision: "month",
          submitted_year: 2024,
          submitted_month: 9,
          resume_version_id: "r",
          season: "summer",
          season_year: 2027,
        },
        {
          id: "2",
          company_name: "Contoso Labs",
          role_title: "Eng",
          status: "applied",
          submitted_precision: "unknown",
          submission_date_unknown: true,
        },
      ],
      { now, resumeLabels: { r: "General v2" }, noteCounts: { "1": 3 } },
    );
    const [head, a, b] = csv.trim().split("\r\n");
    expect(head.split(",")).toContain("exported_at");
    expect(a).toContain("'=HYPERLINK()");
    expect(a).toContain(",2024-09,month,false,");
    expect(a).toContain("General v2,3,");
    expect(a.endsWith("2026-10-10T12:34:56.000Z")).toBe(true);
    expect(b).toContain(",,unknown,true,");
  });
  it("owner JSON keeps exact text and only passed arrays", () => {
    const j = ownerExportJson({
      user_id: "u1",
      now,
      profile: { id: "u1" },
      applications: [{ user_id: "u1", company_name: "=raw" }],
      notes: [],
    });
    expect(j).toMatchObject({ schema_version: 1, exported_at: "2026-10-10T12:34:56.000Z", user_id: "u1" });
    expect((j.applications as { company_name: string }[])[0].company_name).toBe("=raw");
    expect(Object.keys(j).sort()).toEqual(["applications", "exported_at", "notes", "profile", "schema_version", "user_id"]);
  });
  it("rejects foreign rows", () => {
    expect(() => ownerExportJson({ user_id: "u1", applications: [{ user_id: "u2" }] })).toThrowError(ExportOwnershipError);
  });
  it("builds safe filenames", () => {
    expect(exportFilename("Applications/../x", "csv", now)).toBe("hephaestus-applications-x-20261010-123456.csv");
  });
});
