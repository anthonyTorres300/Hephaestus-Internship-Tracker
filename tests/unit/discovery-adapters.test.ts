import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { simplifyAdapter, vanshAdapter } from "@/lib/discovery/adapters";
import { assessCompleteness } from "@/lib/discovery/run";

const fx = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures/discovery", n), "utf8");
const ctx = { owner: "o", repo: "r", path: "README.md", commitSha: "a".repeat(40) };

describe("simplify adapter (HTML tables)", () => {
  const r = simplifyAdapter.parse(fx("simplify-readme.md"), ctx);
  const find = (company: string, title?: string) => r.rows.find((x) => x.company === company && (!title || x.title === title))!;

  it("parses sections, continuation rows, and keeps the employer link primary", () => {
    expect(r.complete).toBe(true);
    expect(r.rows.filter((x) => x.company === "Electronic Arts")).toHaveLength(3);
    const ea = find("Electronic Arts", "Software Engineer Co-op");
    expect(ea.apply_url).toContain("jobs.ea.com");
    expect(ea.alternate_urls[0]).toContain("simplify.jobs/p/");
    expect(ea.canonical_url).not.toContain("utm_source");
    const trLine =
      fx("simplify-readme.md")
        .split("\n")
        .findIndex((l) => l.includes("/216231?")) +
      1 -
      4;
    expect(ea.permalink).toBe(`https://github.com/o/r/blob/${"a".repeat(40)}/README.md#L${trLine}`);
  });

  it("derives category/season explicitly per row, never from the repo name", () => {
    expect(find("Electronic Arts").role_category).toBe("software");
    expect(find("Klaviyo")).toMatchObject({ season: "spring", season_year: 2027, role_category: "non_technical" });
    expect(find("GCM Grosvenor")).toMatchObject({
      season: "summer",
      season_year: 2027,
      identity_key: "ats:greenhouse:gcmgrosvenor:8015792003",
    });
    const noHeading = simplifyAdapter.parse(fx("simplify-readme.md").replace("# Summer 2027 Tech Internships", "# Tech Internships"), ctx);
    expect(noHeading.rows.find((x) => x.company === "GCM Grosvenor")).toMatchObject({ season: null, season_year: null });
  });

  it("handles multiple locations, remote, markers and unknown constraints", () => {
    expect(find("Ernst & Young").locations).toEqual(["Nashville, TN", "Dallas, TX", "Chicago, IL", "Atlanta, GA"]);
    expect(find("Leidos")).toMatchObject({ work_mode: "remote", country: "US", requirements: { remote_restricted_to: ["US"] } });
    expect(find("Modernizing Medicine").requirements.graduate_only).toBe(true);
    expect(find("AMD").company).toBe("AMD");
    expect(find("GCM Grosvenor").requirements).toEqual({});
  });

  it("does not treat relative ages as posting dates and excludes them from the row hash", () => {
    const row = find("GCM Grosvenor");
    expect(row).toMatchObject({ listing_text: "1d", listing_kind: "age", source_posted: { precision: "unknown", year: null } });
    const aged = simplifyAdapter.parse(fx("simplify-readme.md").replaceAll("<td>1d</td>", "<td>2d</td>"), ctx);
    expect(aged.rows.find((x) => x.company === "GCM Grosvenor")!.row_hash).toBe(row.row_hash);
    expect(aged.rows.find((x) => x.company === "GCM Grosvenor")!.entry_key).toBe(row.entry_key);
  });

  it("marks closed rows without an apply link as source_closed", () => {
    expect(find("Moog")).toMatchObject({ state: "source_closed", apply_url: null, identity_key: null });
  });

  it("excludes new-grad sections and rows, quarantines malformed rows with safe diagnostics", () => {
    expect(r.rows.some((x) => /new grad/i.test(x.title))).toBe(false);
    expect(r.stats.excluded_sections).toBe(1);
    expect(r.quarantined.map((q) => q.code).sort()).toEqual(["bad_cell_count", "bad_cell_count", "no_apply_url", "orphan_continuation"]);
    expect(JSON.stringify(r.quarantined)).not.toMatch(/<|href|Broken Co|javascript/);
  });

  it("keeps entry keys stable when the table is re-sorted", () => {
    const rows = fx("simplify-readme.md").split("\n");
    const swe = simplifyAdapter
      .parse(rows.join("\n"), ctx)
      .rows.filter((x) => x.company !== "Electronic Arts" && !x.company.startsWith("Ernst"));
    const shuffled = fx("simplify-readme.md").replace(
      /(<tr>\n<td><strong><a href="https:\/\/simplify.jobs\/c\/GCM[\s\S]*?<\/tr>\n)([\s\S]*?)(<tr>\n<td><strong><a href="https:\/\/simplify.jobs\/c\/Ernst[\s\S]*?<\/tr>\n)/,
      "$3$2$1",
    );
    expect(shuffled).not.toBe(fx("simplify-readme.md"));
    const after = simplifyAdapter.parse(shuffled, ctx).rows;
    for (const x of swe) expect(after.find((y) => y.entry_key === x.entry_key)?.row_hash).toBe(x.row_hash);
  });

  it("fails cleanly on empty/structureless or truncated input without inventing rows", () => {
    expect(simplifyAdapter.parse("# Nothing here", ctx)).toMatchObject({ rows: [], complete: false, errorCode: "no_tables_found" });
    const cut = fx("simplify-readme.md").slice(0, fx("simplify-readme.md").indexOf("</tbody>"));
    expect(simplifyAdapter.parse(cut, ctx)).toMatchObject({ complete: false, errorCode: "truncated_table" });
    expect(simplifyAdapter.parse("<table><tr><th>X</th></tr><tr><td>1</td></tr></table>", ctx)).toMatchObject({
      complete: false,
      errorCode: "unrecognized_table",
      rows: [],
    });
  });
});

describe("vansh adapter (pipe table)", () => {
  const r = vanshAdapter.parse(fx("vansh-readme.md"), ctx);
  const find = (company: string, title?: string) => r.rows.find((x) => x.company === company && (!title || x.title.startsWith(title)))!;

  it("parses continuation rows, markers, </br> and <details> locations", () => {
    expect(r.complete).toBe(true);
    expect(find("Vertiv", "Product Management Intern,").company).toBe("Vertiv");
    expect(find("Vertiv", "Product Management Intern").requirements.sponsorship_offered).toBe(false);
    expect(find("Teledyne Technologies Incorporated").requirements.requires_citizenship).toEqual(["US"]);
    expect(find("Notion").locations).toEqual(["San Francisco, CA", "New York, NY"]);
    expect(find("Atoms").locations).toHaveLength(5);
    expect(find("Atoms").identity_key).toBe("ats:greenhouse:cssmerge:8687896002");
    expect(find("Epic Games", "Gameplay").identity_key).toContain("gh_jid=6141180004");
  });

  it("keeps closed state, explicit season override and unknown (year-less) dates", () => {
    expect(find("CNO Financial Group")).toMatchObject({ state: "source_closed", apply_url: null });
    expect(find("Granite Construction")).toMatchObject({ season: "summer", season_year: 2026 });
    expect(find("Replit")).toMatchObject({
      season: "summer",
      season_year: 2027,
      listing_text: "Aug 21",
      source_posted: { precision: "unknown" },
    });
  });

  it("excludes new-grad titles and quarantines malformed rows", () => {
    expect(r.rows.some((x) => x.company === "Mallory")).toBe(false);
    expect(r.stats.excluded_new_grad).toBe(1);
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
  });

  it("is incomplete when the table end marker is missing, and fails cleanly on empty content", () => {
    expect(vanshAdapter.parse(fx("vansh-readme.md").replace("TABLE_END", "X"), ctx)).toMatchObject({
      complete: false,
      errorCode: "truncated_table",
    });
    expect(vanshAdapter.parse("# Summer 2027\n\nnothing", ctx)).toMatchObject({ rows: [], complete: false, errorCode: "no_tables_found" });
  });
});

describe("completeness", () => {
  it("flags many malformed rows as incomplete", () => {
    const base = simplifyAdapter.parse(fx("simplify-readme.md"), ctx);
    expect(assessCompleteness(base, 0.5).complete).toBe(true);
    expect(assessCompleteness(base, 0.1)).toEqual({ complete: false, reason: "too_many_malformed_rows" });
    expect(assessCompleteness({ ...base, complete: false, errorCode: "truncated_table" }, 1)).toEqual({
      complete: false,
      reason: "truncated_table",
    });
  });
});
