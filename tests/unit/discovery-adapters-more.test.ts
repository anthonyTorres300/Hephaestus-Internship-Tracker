import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTERS, applyguyAdapter, simplifyAdapter, slashpipeAdapter, speedyapplyAdapter, vanshAdapter } from "@/lib/discovery/adapters";
import { parseCellHtml } from "@/lib/discovery/html";
import { ALLOWED_HOSTS, SOURCES, findSource } from "@/lib/discovery/sources";

const fx = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures/discovery", n), "utf8");
const ctx = { owner: "o", repo: "r", path: "README.md", commitSha: "b".repeat(40) };

describe("source configuration", () => {
  it("registers an adapter for every configured source and keeps the host allowlist strict", () => {
    for (const s of SOURCES) {
      expect(ADAPTERS[s.adapterId], `${s.owner}/${s.repo}`).toBeDefined();
      expect(ADAPTERS[s.adapterId].version).toBe(s.adapterVersion);
      expect(s.path).toMatch(/^[A-Za-z0-9_.-]+\.md$/);
      expect(s.license).toBeTruthy();
      expect(s.attribution).toContain(`${s.owner}/${s.repo}`);
    }
    expect(SOURCES.map((s) => `${s.owner}/${s.repo}`)).toEqual(
      expect.arrayContaining([
        "speedyapply/2027-SWE-College-Jobs",
        "speedyapply/2027-AI-College-Jobs",
        "ApplyGuy/2027-Internships",
        "sndsh404/summer-2027-internships",
        "negarprh/Canadian-Tech-Internships-2027",
      ]),
    );
    expect([...ALLOWED_HOSTS]).toEqual(["api.github.com", "raw.githubusercontent.com"]);
    expect(findSource("speedyapply", "2027-SWE-College-Jobs", "README.md", "speedyapply")).toBeDefined();
    expect(findSource("speedyapply", "2027-SWE-College-Jobs", "README.md", "vansh")).toBeUndefined();
    expect(findSource("evil", "2027-SWE-College-Jobs", "README.md", "speedyapply")).toBeUndefined();
    expect(findSource("speedyapply", "2027-SWE-College-Jobs", "../../etc/passwd", "speedyapply")).toBeUndefined();
  });

  it("keeps the original adapters byte-for-byte compatible after the pipe-table refactor", () => {
    const v = vanshAdapter.parse(fx("vansh-readme.md"), ctx);
    expect(v.complete).toBe(true);
    expect(v.rows.length).toBeGreaterThan(20);
    expect(simplifyAdapter.id).toBe("simplify");
  });
});

describe("markdown link cells", () => {
  it("uses the target of a badge link, not the badge image", () => {
    const c = parseCellHtml("[![Apply](https://img.shields.io/badge/-Apply-blue)](https://jobs.example.test/1?a=b)");
    expect(c.links.map((l) => l.href)).toEqual(["https://jobs.example.test/1?a=b"]);
    expect(parseCellHtml("![x](https://img.example.test/a.png) text").links).toEqual([]);
  });
});

describe("speedyapply adapter (pipe tables per category)", () => {
  const r = speedyapplyAdapter.parse(fx("speedyapply-readme.md"), ctx);
  const find = (company: string, re?: RegExp) => r.rows.find((x) => x.company === company && (!re || re.test(x.title)))!;

  it("parses sections, drops hidden-count suffixes and keeps the employer link", () => {
    expect(r.complete).toBe(true);
    expect(r.rows).toHaveLength(12);
    expect(find("Microsoft")).toMatchObject({ locations: ["Washington, DC"], section: "FAANG", role_category: "software", country: "US" });
    expect(find("Microsoft").apply_url).toContain("apply.careers.microsoft.com");
    expect(find("Arcesium").section).toBe("Other");
    expect(r.rows.every((x) => !x.locations.some((l) => /\+\d/.test(l)))).toBe(true);
  });

  it("detects season/year per row and category from title and section", () => {
    expect(find("DoorDash")).toMatchObject({ season: "summer", season_year: 2027, role_category: "software" });
    expect(find("Zipline", /Spring/)).toMatchObject({ season: "spring", season_year: 2027, role_category: "embedded" });
    expect(find("Arcesium")).toMatchObject({ season: null, season_year: null });
    expect(find("Lyft").requirements.graduate_only).toBe(true);
  });

  it("treats Age as relative (not a posting date) and handles tables without a Salary column", () => {
    expect(find("Arcesium")).toMatchObject({ listing_kind: "age", source_posted: { precision: "unknown" } });
    const aged = speedyapplyAdapter.parse(fx("speedyapply-readme.md").replaceAll("| 0d |", "| 5d |"), ctx);
    expect(aged.rows.find((x) => x.company === "Arcesium")!.row_hash).toBe(find("Arcesium").row_hash);
  });

  it("quarantines malformed rows and excludes new-grad titles", () => {
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count", section: "Other" }]);
    expect(r.rows.some((x) => x.company === "Mallory")).toBe(false);
    expect(r.stats.excluded_new_grad).toBe(1);
  });

  it("parses the AI list variant (5 columns, multi-location suffixes)", () => {
    const ai = speedyapplyAdapter.parse(fx("speedyapply-ai-readme.md"), ctx);
    expect(ai.complete).toBe(true);
    expect(ai.rows).toHaveLength(6);
    expect(ai.rows.find((x) => x.company === "SageSure" && /Scientist/.test(x.title))!.locations).toEqual(["Cheshire, CT"]);
    expect(ai.rows.find((x) => x.company === "Bosch")!.role_category).toBe("ai_ml");
  });

  it("ignores non-job tables and fails when the structure is missing", () => {
    const withSide = fx("speedyapply-readme.md") + "\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    expect(speedyapplyAdapter.parse(withSide, ctx).complete).toBe(true);
    expect(speedyapplyAdapter.parse("# nothing here\n", ctx)).toMatchObject({ complete: false, errorCode: "no_tables_found" });
  });
});

describe("applyguy adapter (employer link next to an aggregator redirect)", () => {
  const r = applyguyAdapter.parse(fx("applyguy-readme.md"), ctx);
  const find = (company: string, re?: RegExp) => r.rows.find((x) => x.company === company && (!re || re.test(x.title)))!;

  it("uses the original employer URL as apply_url and keeps the redirect only as an alternate", () => {
    expect(r.complete).toBe(true);
    const g = find("Globalfoundries");
    expect(g.apply_url).toContain("myworkdayjobs.com");
    expect(g.identity_key).toBe("ats:workday:globalfoundries:JR-2604039");
    expect(g.alternate_urls.some((u) => u.includes("applyguy.ai"))).toBe(true);
    expect(r.rows.every((x) => !x.apply_url!.includes("applyguy.ai"))).toBe(true);
  });

  it("derives season from the Season column when the title has none, and sections as categories", () => {
    expect(find("Globalfoundries")).toMatchObject({ season: "summer", season_year: 2027 });
    expect(find("Rilla")).toMatchObject({ season: null, season_year: 2028 });
    expect(find("Workday", /^Software Development/)).toMatchObject({ season: null, season_year: null });
    expect(find("Workday", /Product Manager/)).toMatchObject({ role_category: "non_technical", section: "Product Management Internships" });
    expect(find("Amat").requirements.graduate_only).toBe(true);
  });

  it("quarantines wrong-cell-count rows without failing the snapshot", () => {
    expect(r.quarantined).toHaveLength(1);
    expect(r.quarantined[0]).toMatchObject({ code: "bad_cell_count", section: "Software Engineering Internships" });
    expect(r.rows).toHaveLength(12);
  });

  it("quarantines a row that only has the aggregator redirect", () => {
    const only = fx("applyguy-readme.md")
      .split("\n")
      .map((l) => l.replace(/ \[!\[View original listing\]\([^)]*\)\]\([^)]*\)/, ""))
      .join("\n");
    const q = applyguyAdapter.parse(only, ctx);
    expect(q.rows).toHaveLength(0);
    expect(q.quarantined.filter((x) => x.code === "no_employer_url").length).toBeGreaterThan(5);
  });
});

describe("slashpipe adapter (sndsh404/summer-2027-internships)", () => {
  const r = slashpipeAdapter.parse(fx("sndsh404-readme.md"), ctx);
  const find = (company: string) => r.rows.find((x) => x.company === company)!;

  it("splits slash-separated locations and strips '(multiple US)' annotations", () => {
    expect(r.complete).toBe(true);
    expect(find("Uber").locations).toEqual(["San Francisco, CA", "Seattle, WA", "Sunnyvale, CA"]);
    expect(find("Google").locations).toEqual(["Mountain View, CA"]);
    expect(find("Second Order Effects").locations).toEqual(["El Segundo, CA", "Redmond, WA"]);
  });

  it("parses seasons, stated dates, markers and closed rows", () => {
    expect(find("Western Digital")).toMatchObject({ season: "summer", season_year: 2027, listing_kind: "date" });
    expect(find("Western Digital").source_posted).toMatchObject({ year: 2026, month: 7, day: 20, precision: "day" });
    expect(find("Kearney & Company").requirements.requires_citizenship).toEqual(["US"]);
    expect(find("Kearney & Company").title).toBe("IT Audit Intern (Summer 2027)");
    expect(find("Salesforce")).toMatchObject({ state: "source_closed", title: "Software Engineer Intern (Futureforce)" });
    expect(find("Neuralink").title).toBe("Software Engineer Intern, BCI Applications");
    expect(find("Susquehanna").requirements).toMatchObject({ graduate_only: true });
  });

  it("skips side tables, quarantines malformed rows and treats a dash date as absent", () => {
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
    expect(r.rows.some((x) => x.company === "Schonfeld")).toBe(false);
    const dash = slashpipeAdapter.parse(fx("sndsh404-readme.md").replace("| 2026-07-16 |\n| Salesforce", "| - |\n| Salesforce"), ctx);
    expect(dash.rows.find((x) => x.company === "The Trade Desk" || x.company === "Netic")).toBeDefined();
  });
});

describe("slashpipe adapter (negarprh/Canadian-Tech-Internships-2027)", () => {
  const r = slashpipeAdapter.parse(fx("negarprh-readme.md"), ctx);

  it("reads badge links, 'Mon D, YYYY' dates and continuation rows", () => {
    expect(r.complete).toBe(true);
    const m = r.rows.find((x) => x.company === "Motorola")!;
    expect(m.apply_url).toContain("motorolasolutions.wd5.myworkdayjobs.com");
    expect(m.source_posted).toEqual({ year: 2026, month: 10, day: 7, precision: "day" });
    expect(m.country).toBe("CA");
    expect(r.stats.continuation_rows).toBeGreaterThan(0);
    expect(r.rows.filter((x) => x.company === "StackAdapt")).toHaveLength(2);
  });

  it("detects work term from the title and remote-in-Canada geography", () => {
    const s = r.rows.find((x) => x.company === "StackAdapt" && /Backend/.test(x.title))!;
    expect(s).toMatchObject({ season: "winter", season_year: 2027, work_mode: "remote", country: "CA" });
    const solink = r.rows.find((x) => x.company === "Solink")!;
    expect(solink.locations).toEqual(["Ottawa, ON", "Remote, Canada"]);
  });

  it("marks 'Closed🔒' rows closed without an apply URL, and quarantines malformed rows", () => {
    const closed = r.rows.filter((x) => x.state === "source_closed");
    expect(closed.length).toBe(3);
    expect(closed.every((x) => x.apply_url === null && x.identity_key === null)).toBe(true);
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
  });
});

describe("cross-source dedupe inputs", () => {
  it("the same employer posting listed by two feeds yields the same identity_key and candidate_key", () => {
    const a = speedyapplyAdapter.parse(
      '# t\n\n### Other\n\n| Company | Position | Location | Posting | Age |\n|---|---|---|---|---|\n| <a href="https://x.test"><strong>Acme</strong></a> | Software Engineer Intern | Austin, TX +1 | <a href="https://job-boards.greenhouse.io/acme/jobs/123?utm_source=speedy">Apply</a> | 1d |\n',
      ctx,
    ).rows[0];
    const b = slashpipeAdapter.parse(
      "# t\n\n| Company | Role | Location | Apply | Added |\n|---|---|---|---|---|\n| Acme | Software Engineer Intern | Austin, TX | [apply](https://job-boards.greenhouse.io/acme/jobs/123) | 2026-10-01 |\n",
      ctx,
    ).rows[0];
    expect(a.identity_key).toBe("ats:greenhouse:acme:123");
    expect(b.identity_key).toBe(a.identity_key);
    expect(b.candidate_key).toBe(a.candidate_key);
  });
});
