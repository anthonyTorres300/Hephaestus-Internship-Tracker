// Conservative HTML/Markdown extraction. Source markup is untrusted: it is tokenized as data, never rendered or executed.

export interface Tok {
  t: "text" | "open" | "close";
  name?: string;
  attrs?: Record<string, string>;
  text?: string;
  line: number;
}

export interface Link {
  href: string;
  text: string;
  alt: string | null;
}

export interface Cell {
  text: string;
  lines: string[];
  links: Link[];
  summary: string | null;
  header: boolean;
}

export interface TableRow {
  line: number;
  cells: Cell[];
  truncated: boolean;
}

export interface Table {
  startLine: number;
  headers: Cell[] | null;
  rows: TableRow[];
  closed: boolean;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const RAW_TEXT = new Set(["script", "style"]);
const MAX_TOKENS = 2_000_000;

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function tokenize(html: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  let buf = "";
  const flush = () => {
    if (buf) toks.push({ t: "text", text: buf, line });
    buf = "";
  };
  const countLines = (s: string) => {
    for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) line++;
  };
  while (i < html.length) {
    if (toks.length > MAX_TOKENS) throw new Error("too_many_tokens");
    const c = html[i];
    if (c !== "<") {
      const next = html.indexOf("<", i);
      const end = next === -1 ? html.length : next;
      const chunk = html.slice(i, end);
      countLines(chunk);
      buf += chunk;
      i = end;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      const stop = end === -1 ? html.length : end + 3;
      flush();
      countLines(html.slice(i, stop));
      i = stop;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(i, i + 40));
    if (!m) {
      buf += c;
      i++;
      continue;
    }
    flush();
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    let j = i + m[0].length;
    const attrs: Record<string, string> = {};
    let quote = "";
    let attrBuf = "";
    for (; j < html.length; j++) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
      attrBuf += ch;
    }
    if (!closing) {
      const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a: RegExpExecArray | null;
      while ((a = re.exec(attrBuf))) attrs[a[1].toLowerCase()] ??= decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    }
    toks.push({ t: closing ? "close" : "open", name, attrs, line });
    countLines(html.slice(i, j + 1));
    i = j + 1;
    if (!closing && RAW_TEXT.has(name)) {
      const re = new RegExp(`</${name}\\s*>`, "i");
      const rest = html.slice(i);
      const mm = re.exec(rest);
      const skip = mm ? mm.index + mm[0].length : rest.length;
      countLines(rest.slice(0, skip));
      i += skip;
    }
  }
  flush();
  return toks;
}

export function cleanText(s: string): string {
  return decodeEntities(s)
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mdLinksToAnchors(s: string): string {
  // Badge-style links "[![alt](image)](url)" link to url (the image is only decoration); bare "![alt](image)" is dropped to its alt text.
  s = s
    .replace(
      /\[!\[([^\]\n]{0,200})\]\([^)\s]{1,2000}\)\]\((https?:\/\/[^)\s]{1,2000})\)/g,
      (_m, t: string, u: string) => `<a href="${u.replace(/"/g, "%22")}">${t}</a>`,
    )
    .replace(/!\[([^\]\n]{0,200})\]\([^)\s]{1,2000}\)/g, "$1");
  return s.replace(
    /\[([^\]\n]{1,200})\]\((https?:\/\/[^)\s]{1,2000})\)/g,
    (_m, t: string, u: string) => `<a href="${u.replace(/"/g, "%22")}">${t}</a>`,
  );
}

export function parseCell(toks: Tok[], header = false): Cell {
  let text = "";
  let summary: string | null = null;
  let inSummary = false;
  let link: { href: string; text: string; alt: string | null } | null = null;
  const links: Link[] = [];
  for (const k of toks) {
    if (k.t === "text") {
      if (inSummary) summary = (summary ?? "") + k.text;
      else {
        text += k.text;
        if (link) link.text += k.text;
      }
    } else if (k.t === "open") {
      if (k.name === "br") text += "\n";
      else if (k.name === "summary") inSummary = true;
      else if (k.name === "a") link = { href: (k.attrs?.href ?? "").trim(), text: "", alt: null };
      else if (k.name === "img" && link) link.alt ??= cleanText(k.attrs?.alt ?? "") || null;
      else if (k.name === "img") text += "";
    } else {
      if (k.name === "br") text += "\n";
      else if (k.name === "summary") inSummary = false;
      else if (k.name === "a" && link) {
        links.push({ href: link.href, text: cleanText(link.text), alt: link.alt });
        link = null;
      }
    }
  }
  const lines = decodeEntities(text)
    .split("\n")
    .map((l) =>
      l
        .replace(/\*\*|__/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return { text: lines.join(" "), lines, links, summary: summary === null ? null : cleanText(summary), header };
}

export function parseCellHtml(html: string): Cell {
  return parseCell(tokenize(mdLinksToAnchors(html)));
}

export function parseHtmlTables(html: string): Table[] {
  const toks = tokenize(html);
  const tables: Table[] = [];
  let table: Table | null = null;
  let row: { line: number; cells: Cell[]; truncated: boolean } | null = null;
  let cell: Tok[] | null = null;
  let cellHeader = false;
  let depth = 0;
  const endCell = () => {
    if (cell && row) row.cells.push(parseCell(cell, cellHeader));
    cell = null;
  };
  const endRow = (truncated: boolean) => {
    endCell();
    if (row && table) {
      row.truncated = truncated;
      if (row.cells.length && row.cells.every((c) => c.header)) table.headers ??= row.cells;
      else if (row.cells.length) table.rows.push(row);
    }
    row = null;
  };
  for (const k of toks) {
    if (k.t !== "text" && k.name === "table") {
      if (k.t === "open") {
        depth++;
        if (depth === 1) {
          table = { startLine: k.line, headers: null, rows: [], closed: false };
          tables.push(table);
        }
      } else if (depth > 0) {
        if (depth === 1 && table) {
          endRow(false);
          table.closed = true;
          table = null;
        }
        depth--;
      }
      continue;
    }
    if (!table || depth !== 1) continue;
    if (k.t === "open" && k.name === "tr") {
      endRow(row !== null);
      row = { line: k.line, cells: [], truncated: false };
    } else if (k.t === "close" && k.name === "tr") endRow(false);
    else if (k.t === "open" && (k.name === "td" || k.name === "th")) {
      if (!row) row = { line: k.line, cells: [], truncated: true };
      endCell();
      cell = [];
      cellHeader = k.name === "th";
    } else if (k.t === "close" && (k.name === "td" || k.name === "th")) endCell();
    else if (cell) cell.push(k);
  }
  if (table) endRow(row !== null);
  return tables;
}

export interface Heading {
  line: number;
  level: number;
  text: string;
}

export function parseHeadings(src: string): Heading[] {
  const out: Heading[] = [];
  let fence = false;
  src.split("\n").forEach((raw, idx) => {
    if (/^\s{0,3}(```|~~~)/.test(raw)) fence = !fence;
    if (fence) return;
    const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (m) out.push({ line: idx + 1, level: m[1].length, text: cleanText(m[2].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")) });
  });
  return out;
}

export function splitPipeRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur);
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}
