import { parseHeadings, parseHtmlTables } from "../html";
import type { Adapter } from "../types";
import { Collector, docSeasonFrom, isExcludedSection, mapColumns, sectionFor } from "./common";

// SimplifyJobs/Summer2027-Internships: README.md holds one HTML <table> per category section
// (Company | Role | Location | Application | Age). Their listings.json is >10 MB, so the README is the source.
export const simplifyAdapter: Adapter = {
  id: "simplify",
  version: "1",
  parse(text, ctx) {
    const col = new Collector(ctx);
    let tables;
    try {
      tables = parseHtmlTables(text);
    } catch {
      return col.result({ complete: false, errorCode: "parse_structure_error" });
    }
    if (tables.length === 0) return col.result({ complete: false, errorCode: "no_tables_found" });
    const headings = parseHeadings(text);
    const docSeason = docSeasonFrom(headings);
    let complete = true;
    let errorCode: string | undefined;
    const fail = (c: string) => {
      complete = false;
      errorCode ??= c;
    };
    for (const t of tables) {
      const section = sectionFor(headings, t.startLine);
      col.startTable();
      if (isExcludedSection(section)) {
        col.excludeSection(t.rows.length);
        continue;
      }
      const cols = t.headers ? mapColumns(t.headers.map((h) => h.text)) : null;
      if (!cols) {
        fail("unrecognized_table");
        continue;
      }
      if (!t.closed) fail("truncated_table");
      for (const r of t.rows) {
        if (r.truncated || r.cells.length !== cols.count) {
          col.stats.rows_seen++;
          col.quarantined.push({
            line: r.line,
            code: r.truncated ? "truncated_row" : "bad_cell_count",
            ...(section ? { section: section.slice(0, 80) } : {}),
          });
          continue;
        }
        col.add({
          line: r.line,
          section,
          docSeason,
          cells: {
            company: r.cells[cols.company],
            role: r.cells[cols.role],
            location: r.cells[cols.location],
            application: r.cells[cols.application],
            listing: cols.listing >= 0 ? r.cells[cols.listing] : null,
          },
        });
      }
    }
    return col.result({ complete, errorCode });
  },
};
