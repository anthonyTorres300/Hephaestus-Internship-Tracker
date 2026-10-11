const LEADING_IGNORABLE = /^[\s\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u2060\ufeff]+/;

export function neutralizeFormula(text: string): string {
  const head = text.replace(LEADING_IGNORABLE, "");
  return /^[=+\-@]/.test(head) ? `'${text}` : text;
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = neutralizeFormula(typeof value === "string" ? value : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[], opts: { bom?: boolean } = {}): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(","));
  return (opts.bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}
