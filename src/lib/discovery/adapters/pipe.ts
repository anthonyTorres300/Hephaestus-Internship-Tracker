import { parseCellHtml, parseHeadings, splitPipeRow, type Cell } from "../html";
import { detectSeason } from "../normalize";
import type { Adapter } from "../types";
import { Collector, docSeasonFrom, isExcludedSection, mapColumns, sectionFor } from "./common";

export interface PipeOptions {
  id: string;
  version: string;
  /** Use the nearest preceding heading as the row section (category hints, new-grad section exclusion). */
  sections?: boolean;
  /** Ignore tables that are not job tables (no company/role/location/apply columns) instead of failing the run. */
  skipUnrecognized?: boolean;
  /** Per-location-line rewrite, e.g. split "A / B" or drop "+2" suffixes. */
  locationLines?: (lines: string[]) => string[];
  /** Read a per-row season/year from a "Season" column when present. */
  seasonColumn?: boolean;
  /** Fail as truncated when the README has a TABLE_START marker but no TABLE_END. */
  tableMarkers?: boolean;
  /**
   * Season comes from the nearest section heading ("Summer 2027", "Fall 2026"); sections that name no cycle get none
   * (the document title is not used). Use when one README mixes cycles in separate sections.
   */
  sectionSeason?: boolean;
  /** Strips volatile suffixes (row counts, "(3 openings)") from section headings so they do not churn row hashes. */
  cleanSection?: (section: string) => string;
  /** Per-field cleanup of decorative glyphs/suffixes that are not part of the company or role name. */
  cleanCell?: (text: string, field: "company" | "role") => string;
  /**
   * The list links only through its own redirector (no employer URL). The link in the Role cell (or the Application cell when
   * one exists) is kept as apply_url with link_kind "source_redirect" and no ATS identity.
   */
  redirect?: { hosts: string[]; linkInRole?: boolean };
  /** An "Education" column listing only graduate degrees marks the row graduate-only (read as if the title said so). */
  educationColumn?: boolean;
  /** Fold a "Work Model" column's Remote/Hybrid value into each location ("Austin, TX (Remote)") so work_mode is derived. */
  workModelColumn?: boolean;
}

const stripCell = (c: Cell, clean?: (t: string) => string): Cell =>
  clean ? { ...c, text: clean(c.text), lines: c.lines.map(clean).filter(Boolean) } : c;

// "Masters; PhD" -> "Master's / PhD"; anything that includes Undergrad (or is blank/unknown) gives no hint.
export function educationHint(text: string): string | undefined {
  const t = text.toLowerCase();
  if (!t || /undergrad|bachelor|associate/.test(t)) return undefined;
  const parts = [/master/.test(t) ? "Master's" : "", /ph\.?d|doctor/.test(t) ? "PhD" : ""].filter(Boolean);
  return parts.length ? parts.join(" / ") : undefined;
}

const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function seasonFromCell(text: string) {
  const t = text.trim();
  const d = detectSeason(t);
  if (d.season) return { season: d.season, year: d.year };
  const y = /^(20\d{2})$/.exec(t);
  return y ? { season: null, year: Number(y[1]) } : null;
}

// Generic GitHub-flavoured pipe-table adapter; cells may contain inline HTML or markdown links.
export function createPipeAdapter(opts: PipeOptions): Adapter {
  return {
    id: opts.id,
    version: opts.version,
    parse(text, ctx) {
      const col = new Collector(ctx);
      const lines = text.split("\n");
      const headings = parseHeadings(text);
      const baseSeason = docSeasonFrom(headings);
      let complete = true;
      let errorCode: string | undefined;
      const fail = (c: string) => {
        complete = false;
        errorCode ??= c;
      };
      let tables = 0;
      for (let i = 0; i < lines.length - 1; i++) {
        if (!/^\s*\|/.test(lines[i]) || !SEPARATOR.test(lines[i + 1])) continue;
        const headers = splitPipeRow(lines[i]).map((h) => parseCellHtml(h).text);
        const cols = mapColumns(headers, !!opts.redirect?.linkInRole);
        let j = i + 2;
        while (j < lines.length && /^\s*\|/.test(lines[j])) j++;
        if (!cols) {
          if (!opts.skipUnrecognized) {
            tables++;
            fail("unrecognized_table");
          }
          i = j;
          continue;
        }
        tables++;
        const rawSection = opts.sections || opts.sectionSeason ? sectionFor(headings, i + 1) : null;
        const section = rawSection && opts.cleanSection ? opts.cleanSection(rawSection) || null : rawSection;
        const tableSeason = opts.sectionSeason
          ? (() => {
              const d = section ? detectSeason(section) : { season: null, year: null };
              return { season: d.season, year: d.year };
            })()
          : baseSeason;
        const eduIdx = opts.educationColumn ? headers.findIndex((h) => /^education$/i.test(h)) : -1;
        const workIdx = opts.workModelColumn ? headers.findIndex((h) => /work\s*model/i.test(h)) : -1;
        const seasonIdx = opts.seasonColumn ? headers.findIndex((h) => /season/i.test(h)) : -1;
        col.startTable();
        if (isExcludedSection(section)) {
          col.excludeSection(j - i - 2);
          i = j;
          continue;
        }
        for (let k = i + 2; k < j; k++) {
          const cells = splitPipeRow(lines[k]);
          if (cells.length !== cols.count) {
            col.stats.rows_seen++;
            col.quarantined.push({ line: k + 1, code: "bad_cell_count", ...(section ? { section: section.slice(0, 80) } : {}) });
            continue;
          }
          const parsed = cells.map((c) => parseCellHtml(c));
          const location = parsed[cols.location];
          if (opts.locationLines) location.lines = opts.locationLines(location.lines);
          if (workIdx >= 0) {
            const mode = /^(remote|hybrid)$/i.exec(parsed[workIdx].text.trim())?.[1]?.toLowerCase();
            const label = mode === "remote" ? "Remote" : "Hybrid";
            if (mode && location.lines.length === 0) location.lines = [label];
            else if (mode) location.lines = location.lines.map((l) => (new RegExp(`\\b${mode}\\b`, "i").test(l) ? l : `${l} (${label})`));
          }
          const rowSeason = seasonIdx >= 0 ? seasonFromCell(parsed[seasonIdx].text) : null;
          const application = opts.redirect?.linkInRole ? parsed[cols.role] : parsed[cols.application];
          col.add({
            line: k + 1,
            section,
            docSeason: rowSeason ?? tableSeason,
            redirectHosts: opts.redirect?.hosts,
            educationHint: eduIdx >= 0 ? educationHint(parsed[eduIdx].text) : undefined,
            cells: {
              company: stripCell(parsed[cols.company], opts.cleanCell && ((t) => opts.cleanCell!(t, "company"))),
              role: stripCell(parsed[cols.role], opts.cleanCell && ((t) => opts.cleanCell!(t, "role"))),
              location,
              application,
              listing: cols.listing >= 0 ? parsed[cols.listing] : null,
            },
          });
        }
        i = j;
      }
      if (tables === 0) fail("no_tables_found");
      if (opts.tableMarkers && text.includes("TABLE_START") && !text.includes("TABLE_END")) fail("truncated_table");
      return col.result({ complete, errorCode });
    },
  };
}
