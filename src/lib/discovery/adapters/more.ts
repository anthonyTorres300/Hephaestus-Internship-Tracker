import { createPipeAdapter } from "./pipe";

const GLYPHS = /[\u{1F195}\u{1F181}\u{1F310}✓✔]/gu; // 🆕 🆁 🌐 ✓ ✔ decorate company/role names but are not part of them
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g; // anti-copy characters inserted inside words
// "Chicago, United States; New York, United States" -> two locations (the country stays: it is how country is derived).
const splitLocations = (lines: string[]) =>
  lines
    .flatMap((l) => l.replace(ZERO_WIDTH, "").split(/\s*;\s*/))
    .map((l) => l.trim())
    .filter(Boolean);

// aprameyak/2027-tech-jobs: SUMMER.md and OFFCYCLE.md each hold one pipe table between TABLE_START/TABLE_END markers
// (Company | Role | Location | [Season / Term] | Education | Application/Link | Date Added) with direct employer/ATS links.
// The Education column ("Masters; PhD") marks graduate-only rows.
export const aprameyakAdapter = createPipeAdapter({
  id: "aprameyak",
  version: "1",
  tableMarkers: true,
  seasonColumn: true,
  educationColumn: true,
});

// jobbie-bot/Summer-2027-Tech-Internships: one pipe table (Company | Role | Location | Posted | Link | Apply with Jobbie).
// The Link column is the employer/ATS posting; the Jobbie column is a referral link to the list's own service and is ignored.
// Titles carry a volatile pay suffix ("Software Engineer Intern · $107,400 – $158K") that is not part of the role name.
export const jobbieAdapter = createPipeAdapter({
  id: "jobbie",
  version: "1",
  locationLines: splitLocations,
  cleanCell: (t) =>
    t
      .replace(ZERO_WIDTH, "")
      .replace(/\s+·\s+\$.*$/, "")
      .trim(),
});

// resumax/tech-internships: one pipe table (Company | Role | Location | Apply | Tailor | Age); Apply is the employer/ATS link,
// the company link and Tailor column point at resumax.ai and are ignored.
export const resumaxAdapter = createPipeAdapter({
  id: "resumax",
  version: "1",
  locationLines: splitLocations,
  cleanCell: (t) => t.replace(ZERO_WIDTH, "").replace(GLYPHS, "").replace(/\s+/g, " ").trim(),
});

// zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships: pipe tables per cycle section
// (Company | Role | Apply | Location | Skills | Posted). Season comes from the section heading; the "cycle not stated" section gets none.
// Counts in headings and "(3 openings)" suffixes are stripped so they do not churn row hashes. The Drop Radar/closed tables
// (no Location column) are skipped.
export const zshahAdapter = createPipeAdapter({
  id: "zshah",
  version: "1",
  sectionSeason: true,
  skipUnrecognized: true,
  cleanSection: (s) => s.replace(/\s+\d+\s+(employer[- ]stated|roles?)\s*$/i, "").trim(),
  locationLines: splitLocations,
  cleanCell: (t) =>
    t
      .replace(ZERO_WIDTH, "")
      .replace(GLYPHS, "")
      .replace(/\(\s*\d+\s+openings?\s*\)/gi, "")
      .replace(/\s+/g, " ")
      .replace(/_+/g, "")
      .trim(),
});

// jobright-ai/2026-{Software-Engineer,Data-Analysis,Engineer}-Internship: pipe table (Company | Job Title | Location | Work Model |
// Date Posted). The only per-job link is a jobright.ai redirect on the title; the company link is an employer homepage, not an
// application page. The redirect is stored as apply_url with link_kind "source_redirect" and no ATS identity.
export const jobrightAdapter = createPipeAdapter({
  id: "jobright",
  version: "1",
  redirect: { hosts: ["jobright.ai"], linkInRole: true },
  workModelColumn: true,
  // "Tempe, AZ, United States" -> "Tempe, AZ" so the candidate key matches lists that omit the country.
  locationLines: (lines) => lines.map((l) => l.replace(/,\s*United States$/i, "")),
});
