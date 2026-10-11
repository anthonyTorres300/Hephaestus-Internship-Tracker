import Papa from "papaparse";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;

export const ORIGINAL_HEADERS = [
  "Company Name",
  "Position Applied For",
  "Application Date",
  "Status",
  "Interview Date",
  "Offer Received",
  "To Check Progress",
] as const;

export type ImportField =
  | "company_name"
  | "role_title"
  | "application_date"
  | "status"
  | "interview_date"
  | "offer_received"
  | "to_check_progress"
  | "original_status"
  | "original_application_date"
  | "season"
  | "season_year"
  | "role_category"
  | "priority"
  | "application_url"
  | "portal_url"
  | "submission_date_unknown";

export const IMPORT_FIELDS: ImportField[] = [
  "company_name",
  "role_title",
  "application_date",
  "status",
  "interview_date",
  "offer_received",
  "to_check_progress",
  "original_status",
  "original_application_date",
  "season",
  "season_year",
  "role_category",
  "priority",
  "application_url",
  "portal_url",
  "submission_date_unknown",
];

export type ColumnMap = Record<ImportField, number | null>;

export interface ParseIssue {
  code: "quotes" | "extra_cells" | "empty_header" | "parse";
  message: string;
  row?: number;
}

export type Delimiter = "," | "\t";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  delimiter: Delimiter;
  rowCount: number;
  errors: ParseIssue[];
}

export class ImportLimitError extends Error {
  constructor(
    public code: "too_large" | "too_many_rows",
    message: string,
  ) {
    super(message);
    this.name = "ImportLimitError";
  }
}

const ALIASES: Record<ImportField, string[]> = {
  company_name: ["company name", "company"],
  role_title: ["position applied for", "role title", "role", "position", "title"],
  application_date: ["application date", "submitted date", "date applied"],
  status: ["status"],
  interview_date: ["interview date"],
  offer_received: ["offer received", "offer date"],
  to_check_progress: ["to check progress", "contact channel"],
  original_status: ["original status"],
  original_application_date: ["original application date"],
  season: ["season"],
  season_year: ["season year"],
  role_category: ["role category", "category"],
  priority: ["priority"],
  application_url: ["application url"],
  portal_url: ["portal url"],
  submission_date_unknown: ["submission date unknown"],
};

export function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ")
    .trim();
}

export function mapColumns(headers: string[], override?: Partial<Record<ImportField, number | null>>): ColumnMap {
  const norm = headers.map(normalizeHeader);
  const out = {} as ColumnMap;
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    if (override && f in override) {
      const v = override[f] ?? null;
      out[f] = v !== null && v >= 0 && v < headers.length ? v : null;
      if (out[f] !== null) used.add(out[f] as number);
      continue;
    }
    let idx = -1;
    for (const a of ALIASES[f]) {
      idx = norm.findIndex((n, i) => n === a && !used.has(i));
      if (idx >= 0) break;
    }
    out[f] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

function detectDelimiter(text: string): Delimiter {
  let inQ = false;
  let commas = 0;
  let tabs = 0;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ) {
      if (ch === "\n") {
        if (commas + tabs > 0) break;
      } else if (ch === ",") commas++;
      else if (ch === "\t") tabs++;
    }
  }
  return tabs > 0 && tabs >= commas ? "\t" : ",";
}

const blankRow = (r: string[]) => r.every((c) => c.trim() === "");

export function parseTable(text: string, opts: { delimiter?: "auto" | "," | "\t" } = {}): ParsedTable {
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new ImportLimitError("too_large", "File exceeds 5 MB");
  }
  const clean = text.replace(/^﻿/, "");
  const delimiter: Delimiter = opts.delimiter === "," || opts.delimiter === "\t" ? opts.delimiter : detectDelimiter(clean);
  const res = Papa.parse<string[]>(clean, { delimiter, skipEmptyLines: false });
  const errors: ParseIssue[] = [];
  for (const e of res.errors) {
    if (e.type === "Quotes") {
      errors.push({ code: "quotes", message: e.message, row: e.row === undefined ? undefined : e.row + 1 });
    } else if (e.type !== "Delimiter") {
      errors.push({ code: "parse", message: e.message, row: e.row === undefined ? undefined : e.row + 1 });
    }
  }
  const all = res.data;
  while (all.length > 0 && blankRow(all[all.length - 1])) all.pop();
  let start = 0;
  while (start < all.length && blankRow(all[start])) start++;
  if (start >= all.length) return { headers: [], rows: [], delimiter, rowCount: 0, errors };
  const headers = all[start].map((h) => h.trim());
  const rows = all.slice(start + 1);
  if (rows.length > MAX_ROWS) {
    throw new ImportLimitError("too_many_rows", `More than ${MAX_ROWS} data rows`);
  }
  if (headers.some((h) => h === "")) {
    errors.push({ code: "empty_header", message: "One or more header cells are empty", row: start + 1 });
  }
  const width = headers.length;
  const padded = rows.map((r, i) => {
    if (r.length > width && r.slice(width).some((c) => c.trim() !== "")) {
      errors.push({ code: "extra_cells", message: `Row has ${r.length} cells, header has ${width}`, row: start + i + 2 });
    }
    return r.length >= width ? r.slice(0, width) : [...r, ...Array(width - r.length).fill("")];
  });
  return { headers, rows: padded, delimiter, rowCount: padded.length, errors };
}
