import type { Cell, Heading } from "../html";
import { EXCLUDED_SECTION, detectSeason } from "../normalize";
import { buildRow, finalizeRows, type RawRow } from "../row";
import type { AdapterContext, AdapterResult, Quarantine, SnapshotRow } from "../types";

export interface Columns {
  company: number;
  role: number;
  location: number;
  application: number;
  listing: number;
  count: number;
}

export function mapColumns(headers: string[], applicationInRole = false): Columns | null {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const cols = {
    company: find(/company|employer/i),
    role: find(/role|title|position/i),
    location: find(/location/i),
    application: find(/application|link|apply|posting|actions/i),
    listing: find(/\bage\b|date|posted|added/i),
    count: headers.length,
  };
  if (applicationInRole && cols.application < 0) cols.application = cols.role;
  return cols.company < 0 || cols.role < 0 || cols.location < 0 || cols.application < 0 ? null : cols;
}

export function docSeasonFrom(headings: Heading[]): RawRow["docSeason"] {
  const h1 = headings.find((h) => h.level === 1);
  const d = h1 ? detectSeason(h1.text) : { season: null, year: null };
  return { season: d.season, year: d.year };
}

export function sectionFor(headings: Heading[], line: number): string | null {
  let s: Heading | null = null;
  for (const h of headings) {
    if (h.line >= line) break;
    if (h.level >= 2) s = h;
  }
  return s
    ? s.text
        .replace(/[^\p{L}\p{N}&, /-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
}

const RELATIVE_AGE = /^\d+\s*(h|d|w|mo|m|y)$/i;

export function listingOf(text: string): RawRow["listing"] {
  const t = text.trim();
  if (!t || /^[-–—]+$/.test(t)) return null;
  return { text: t, kind: RELATIVE_AGE.test(t) ? "age" : "date" };
}

export class Collector {
  built: { row: SnapshotRow; line: number }[] = [];
  quarantined: Quarantine[] = [];
  stats: Record<string, number> = {
    rows_seen: 0,
    excluded_new_grad: 0,
    excluded_sections: 0,
    excluded_section_rows: 0,
    continuation_rows: 0,
  };
  lastCompany: string | null = null;

  constructor(private readonly ctx: AdapterContext) {}

  excludeSection(rows: number) {
    this.stats.excluded_sections++;
    this.stats.excluded_section_rows += rows;
  }

  startTable() {
    this.lastCompany = null;
  }

  add(args: {
    line: number;
    section: string | null;
    cells: { company: Cell; role: Cell; location: Cell; application: Cell; listing: Cell | null };
    docSeason: RawRow["docSeason"];
    redirectHosts?: string[];
    educationHint?: string;
  }) {
    this.stats.rows_seen++;
    const { cells } = args;
    let company = cells.company.text;
    if (/^[↳↳]$/.test(company)) {
      this.stats.continuation_rows++;
      if (!this.lastCompany) return this.quarantined.push({ line: args.line, code: "orphan_continuation" });
      company = this.lastCompany;
    } else if (company) this.lastCompany = company;
    const res = buildRow({
      line: args.line,
      section: args.section,
      company,
      title: cells.role.text,
      locationLines: cells.location.lines,
      links: cells.application.links,
      applicationText: cells.application.text,
      listing: cells.listing ? listingOf(cells.listing.text) : null,
      docSeason: args.docSeason,
      redirectHosts: args.redirectHosts,
      educationHint: args.educationHint,
      markerText: `${cells.company.text} ${cells.role.text} ${cells.location.text}`,
    });
    if ("row" in res) this.built.push({ row: res.row, line: args.line });
    else if ("excluded" in res) this.stats.excluded_new_grad++;
    else this.quarantined.push(res.quarantine);
  }

  result(extra: { complete: boolean; errorCode?: string }): AdapterResult {
    const { rows, duplicates } = finalizeRows(this.built, this.ctx);
    return {
      rows,
      quarantined: this.quarantined.slice(0, 200),
      complete: extra.complete,
      errorCode: extra.errorCode,
      stats: { ...this.stats, duplicates, accepted: rows.length, quarantined: this.quarantined.length },
    };
  }
}

export const isExcludedSection = (s: string | null) => !!s && EXCLUDED_SECTION.test(s);
