import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTERS, aprameyakAdapter, jobbieAdapter, jobrightAdapter, resumaxAdapter, zshahAdapter } from "@/lib/discovery/adapters";
import { educationHint } from "@/lib/discovery/adapters/pipe";
import { ALLOWED_HOSTS, SOURCES, findSource } from "@/lib/discovery/sources";

const fx = (n: string) => readFileSync(join(process.cwd(), "tests/fixtures/discovery", n), "utf8");
const ctx = { owner: "o", repo: "r", path: "README.md", commitSha: "c".repeat(40) };
const by = <T extends { company: string; title: string }>(rows: T[], company: string, re?: RegExp): T =>
  rows.find((r) => r.company === company && (!re || re.test(r.title)))!;

describe("source configuration for the additional lists", () => {
  const added = [
    ["aprameyak/2027-tech-jobs", "SUMMER.md", "aprameyak", "MIT"],
    ["aprameyak/2027-tech-jobs", "OFFCYCLE.md", "aprameyak", "MIT"],
    ["jobbie-bot/Summer-2027-Tech-Internships", "README.md", "jobbie", "MIT"],
    ["resumax/tech-internships", "README.md", "resumax", "MIT"],
    ["zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships", "README.md", "zshah", "MIT"],
    ["jobright-ai/2026-Software-Engineer-Internship", "README.md", "jobright", "none-declared"],
    ["jobright-ai/2026-Data-Analysis-Internship", "README.md", "jobright", "none-declared"],
    ["jobright-ai/2026-Engineer-Internship", "README.md", "jobright", "none-declared"],
  ] as const;

  it("registers each source with a license, attribution and adapter, and keeps the SSRF allowlist unchanged", () => {
    for (const [slug, path, adapter, license] of added) {
      const s = SOURCES.find((x) => `${x.owner}/${x.repo}` === slug && x.path === path);
      expect(s, `${slug}/${path}`).toMatchObject({ adapterId: adapter, license, enabled: true });
      expect(s!.attribution).toContain(slug);
      expect(ADAPTERS[adapter]).toBeDefined();
      expect(findSource(s!.owner, s!.repo, s!.path, adapter)).toBe(s);
    }
    expect(SOURCES.filter((s) => s.adapterId === "jobright").every((s) => /redirect/i.test(s.attribution))).toBe(true);
    expect(new Set(SOURCES.map((s) => `${s.owner}/${s.repo}/${s.path}/${s.adapterId}`)).size).toBe(SOURCES.length);
    expect([...ALLOWED_HOSTS]).toEqual(["api.github.com", "raw.githubusercontent.com"]);
    expect(findSource("aprameyak", "2027-tech-jobs", "../README.md", "aprameyak")).toBeUndefined();
  });
});

describe("aprameyak adapter (SUMMER.md / OFFCYCLE.md)", () => {
  const r = aprameyakAdapter.parse(fx("aprameyak-summer-readme.md"), ctx);

  it("parses the marker-delimited table with direct employer links and ATS identity", () => {
    expect(r.complete).toBe(true);
    expect(r.stats).toMatchObject({ accepted: 28, excluded_new_grad: 1, continuation_rows: 1 });
    const affirm = by(r.rows, "Affirm");
    expect(affirm.apply_url).toContain("job-boards.greenhouse.io/affirm");
    expect(affirm.identity_key).toMatch(/^ats:greenhouse:affirm:/);
    expect(affirm.link_kind).toBeUndefined();
    expect(affirm).toMatchObject({ season: "summer", season_year: 2027, country: "US" });
  });

  it("applies the Education column: graduate-only rows are flagged, undergrad rows are not", () => {
    expect(by(r.rows, "Magna").requirements).toMatchObject({ graduate_only: true, degree_levels: ["masters"] });
    expect(by(r.rows, "Waymo").requirements).toMatchObject({ graduate_only: true, degree_levels: ["phd"] });
    expect(by(r.rows, "Affirm").requirements.graduate_only).toBeUndefined();
    expect(educationHint("Undergrad; Masters")).toBeUndefined();
    expect(educationHint("Masters; PhD")).toBe("Master's / PhD");
    expect(educationHint("")).toBeUndefined();
  });

  it("derives Canada from province names (Ontario, CA is not California)", () => {
    expect(by(r.rows, "Magna").country).toBe("CA");
  });

  it("handles continuation rows, closed markers, malformed rows and new-grad titles", () => {
    expect(by(r.rows, "Tower Research", /Backend/)).toMatchObject({ role_category: "backend", state: "listed" });
    expect(by(r.rows, "Closed Co")).toMatchObject({ state: "source_closed", apply_url: null });
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
    expect(r.rows.some((x) => x.company === "Mallory")).toBe(false);
  });

  it("reads season/term from the OFFCYCLE column and categorizes co-ops", () => {
    const o = aprameyakAdapter.parse(fx("aprameyak-offcycle-readme.md"), ctx);
    expect(o.complete).toBe(true);
    expect(o.rows).toHaveLength(16);
    expect(by(o.rows, "AfterQuery")).toMatchObject({ season: "fall", season_year: 2026, role_category: "ai_ml" });
    expect(by(o.rows, "Hitachi")).toMatchObject({ season: "winter", season_year: 2027, role_category: "software", country: "CA" });
    expect(by(o.rows, "Bosch")).toMatchObject({ role_category: "non_technical", season: "spring" });
  });

  it("fails as truncated when TABLE_END is missing", () => {
    const cut = fx("aprameyak-summer-readme.md").replace(/<!-- TABLE_END[^>]*-->/, "");
    expect(aprameyakAdapter.parse(cut, ctx)).toMatchObject({ complete: false, errorCode: "truncated_table" });
  });
});

describe("jobbie adapter", () => {
  const r = jobbieAdapter.parse(fx("jobbie-readme.md"), ctx);

  it("uses the Link column (employer/ATS), not the referral button, and strips pay suffixes from titles", () => {
    expect(r.complete).toBe(true);
    expect(r.stats).toMatchObject({ accepted: 22, excluded_new_grad: 1 });
    const cresta = by(r.rows, "Cresta");
    expect(cresta.apply_url).toBe("https://job-boards.greenhouse.io/cresta/jobs/5213417008");
    expect(cresta.alternate_urls.some((u) => u.includes("jobbie.bot"))).toBe(false);
    expect(r.rows.every((x) => !/\$/.test(x.title))).toBe(true);
    expect(by(r.rows, "DoorDash")).toMatchObject({
      title: "Software Engineer, Intern - Labs (Summer 2027)",
      season: "summer",
      season_year: 2027,
    });
  });

  it("splits multi-location cells and reads ISO posting dates", () => {
    expect(by(r.rows, "Xaira therapeutics").locations).toHaveLength(2);
    expect(by(r.rows, "Cresta")).toMatchObject({ work_mode: "remote", source_posted: { precision: "day", year: 2026 } });
  });

  it("quarantines malformed rows", () => {
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
  });
});

describe("resumax adapter", () => {
  const r = resumaxAdapter.parse(fx("resumax-readme.md"), ctx);

  it("parses ':--:' alignment separators, ignores resumax.ai company/Tailor links and strips decorative glyphs", () => {
    expect(r.complete).toBe(true);
    expect(r.stats).toMatchObject({ accepted: 24, excluded_new_grad: 1 });
    const sigma = by(r.rows, "Sigma Computing");
    expect(sigma.apply_url).toContain("greenhouse.io/sigmacomputing");
    expect(r.rows.every((x) => !/resumax\.ai/.test(x.apply_url ?? ""))).toBe(true);
    expect(r.rows.every((x) => !/[🆕🆁🌐]/u.test(x.company))).toBe(true);
    expect(sigma).toMatchObject({ role_category: "ai_ml", season: "summer", season_year: 2027 });
    expect(sigma.requirements).toMatchObject({ graduate_only: true, degree_levels: ["phd"] });
  });

  it("maps lowercase country suffixes, splits semicolon locations and treats Age as relative", () => {
    expect(by(r.rows, "Bosch Group", /Full-Stack/)).toMatchObject({ country: "DE", role_category: "fullstack" });
    expect(by(r.rows, "Imc", /Deep Learning/).locations).toEqual(["Chicago, United States", "New York, United States"]);
    expect(r.rows.find((x) => x.listing_kind)?.listing_kind).toBe("age");
  });

  it("classifies by title: civil infrastructure is not devops; software-defined radio hardware is embedded", () => {
    expect(by(r.rows, "Foth").role_category).toBe("other_technical");
    expect(by(r.rows, "Astranis").role_category).toBe("embedded");
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count" }]);
  });
});

describe("zshah adapter", () => {
  const r = zshahAdapter.parse(fx("zshah-readme.md"), ctx);

  it("takes season from the section heading, none for the 'cycle not stated' section, and drops count suffixes", () => {
    expect(r.complete).toBe(true);
    expect(r.stats.accepted).toBe(30);
    expect(by(r.rows, "Workday")).toMatchObject({ section: "Summer 2027", season: "summer", season_year: 2027 });
    expect(by(r.rows, "ABB")).toMatchObject({ section: "Fall 2026", season: "fall", season_year: 2026 });
    const undated = by(r.rows, "Allegion");
    expect(undated).toMatchObject({ season: null, season_year: null });
    expect(undated.section).toMatch(/^Recently posted/);
    expect(r.rows.every((x) => !/\d+ (employer|roles)/.test(x.section ?? ""))).toBe(true);
  });

  it("strips glyphs, zero-width characters and '(N openings)' suffixes; keeps sponsorship markers meaningful", () => {
    expect(r.rows.every((x) => !/[✓🆁🆕​]/u.test(`${x.company}${x.title}${x.locations.join("")}`))).toBe(true);
    expect(by(r.rows, "Workday").title).toBe("Cybersecurity Engineer Intern");
    const gdit = r.rows.find((x) => x.company.startsWith("General Dynamics Information"))!;
    expect(gdit.title).not.toMatch(/openings/);
    expect(gdit.requirements.requires_citizenship).toEqual(["US"]);
  });

  it("skips the Drop Radar and closed-role tables and quarantines malformed rows", () => {
    expect(r.rows.some((x) => /Typical opening/i.test(x.title))).toBe(false);
    expect(r.quarantined).toEqual([{ line: expect.any(Number), code: "bad_cell_count", section: "Summer 2027" }]);
  });
});

describe("jobright adapter (redirector-only links)", () => {
  const r = jobrightAdapter.parse(fx("jobright-readme.md"), ctx);

  it("stores the jobright.ai link as a source redirect (query dropped), never as an employer URL, with no ATS identity", () => {
    expect(r.complete).toBe(true);
    expect(r.stats).toMatchObject({ accepted: 25, excluded_new_grad: 1, continuation_rows: 1 });
    for (const x of r.rows) {
      expect(x.link_kind).toBe("source_redirect");
      expect(x.apply_url).toMatch(/^https:\/\/jobright\.ai\/jobs\/info\/[0-9a-f]+$/);
      expect(x).toMatchObject({ identity_key: null, canonical_url: null, ats_namespace: null, requisition_id: null, alternate_urls: [] });
      expect(x.candidate_key).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(r.rows.some((x) => /meta\.com|coinbase\.com/.test(x.apply_url ?? ""))).toBe(false);
  });

  it("keeps the same candidate key as a direct-link list for the same company, title, location and season", () => {
    const direct = jobbieAdapter.parse(
      "| Company | Role | Location | Posted | Link |\n| --- | --- | --- | --- | --- |\n| Gemini | Software Engineering Intern (Winter 2027) | New York, NY | 2026-10-09 | [Job listing](https://job-boards.greenhouse.io/gemini/jobs/12345) |\n",
      ctx,
    ).rows[0];
    const redirected = by(r.rows, "Gemini");
    expect(direct.identity_key).toMatch(/^ats:greenhouse:gemini:/);
    expect(redirected.candidate_key).toBe(direct.candidate_key);
  });

  it("folds Work Model into locations (Remote/Hybrid) and strips the country suffix", () => {
    expect(by(r.rows, "Coinbase")).toMatchObject({ locations: ["San Francisco, CA (Hybrid)"], work_mode: "hybrid", country: "US" });
    expect(by(r.rows, "Honeywell Aerospace")).toMatchObject({ work_mode: "remote", country: "US" });
  });

  it("quarantines rows without a link or cell count and excludes new-grad titles", () => {
    expect(r.quarantined.map((q) => q.code).sort()).toEqual(["bad_cell_count", "no_apply_url"]);
    expect(r.rows.some((x) => x.company === "Mallory")).toBe(false);
  });

  it("detects degree level, season and category from the title", () => {
    expect(by(r.rows, "Waymo").requirements).toMatchObject({ graduate_only: true, degree_levels: ["masters", "phd"] });
    expect(by(r.rows, "Gemini")).toMatchObject({ season: "winter", season_year: 2027, role_category: "software" });
  });
});

describe("re-parsing is stable", () => {
  it("produces identical hashes for identical input", () => {
    for (const [a, f] of [
      [jobrightAdapter, "jobright-readme.md"],
      [zshahAdapter, "zshah-readme.md"],
    ] as const) {
      const x = a.parse(fx(f), ctx).rows.map((r) => r.row_hash);
      const y = a.parse(fx(f), ctx).rows.map((r) => r.row_hash);
      expect(x).toEqual(y);
    }
  });
});
