import {
  candidateKey,
  deriveIdentity,
  normalizeCompany,
  normalizeLocation,
  normalizeTitle,
  NORMALIZATION_VERSION,
  sha256Hex,
} from "./identity";
import type { Link } from "./html";
import { categorize, deriveGeo, detectSeason, extractRequirements, markersIn, normalizeLocationList, stripMarkers } from "./normalize";
import type { AdapterContext, Quarantine, SnapshotRow, SourcePosted } from "./types";

export interface RawRow {
  line: number;
  section: string | null;
  company: string;
  title: string;
  locationLines: string[];
  links: Link[];
  applicationText: string;
  listing: { text: string; kind: "age" | "date" } | null;
  docSeason: { season: SnapshotRow["season"]; year: number | null };
  markerText: string;
  /** Hosts of the list's own redirector; a link to one of these is a source redirect, never an employer URL. */
  redirectHosts?: string[];
  /** Graduate degree level the list's Education column restricts the row to, e.g. "Master's / PhD". */
  educationHint?: string;
}

export type BuildResult = { row: SnapshotRow } | { excluded: string } | { quarantine: Quarantine };

const AGGREGATORS =
  /(^|\.)(simplify\.jobs|github\.com|githubusercontent\.com|discord\.com|discord\.gg|redirect\.cvrve\.me|cvrve\.me|imgur\.com|applyguy\.ai)$/i;
const MAX_ROW_BYTES = 7000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseListingDate(text: string): SourcePosted {
  const unknown: SourcePosted = { year: null, month: null, day: null, precision: "unknown" };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3], precision: "day" };
  const md = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(text.trim());
  if (md) {
    const mi = MONTHS.indexOf(md[1].slice(0, 3).toLowerCase());
    const day = +md[2];
    if (mi >= 0 && day >= 1 && day <= 31 && md[3]) return { year: +md[3], month: mi + 1, day, precision: "day" };
  }
  return unknown;
}

function httpUrl(href: string): string | null {
  if (!href || href.length > 1000) return null;
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function buildRow(raw: RawRow): BuildResult {
  const q = (code: string): BuildResult => ({
    quarantine: { line: raw.line, code, ...(raw.section ? { section: raw.section.slice(0, 80) } : {}) },
  });
  const markers = markersIn(`${raw.markerText} ${raw.applicationText}`);
  const closed = markers.closed || /^\s*closed\s*$/i.test(raw.applicationText);
  const company = stripMarkers(raw.company);
  const title = stripMarkers(raw.title);
  if (!company) return q("missing_company");
  if (!title) return q("missing_title");
  if (company.length > 200) return q("company_too_long");
  if (title.length > 300) return q("title_too_long");
  if (/\bnew[- ]?grad(uate)?s?\b/i.test(title)) return { excluded: "new_grad" };

  const urls = raw.links.map((l) => httpUrl(l.href)).filter((u): u is string => !!u);
  const redirectHosts = (raw.redirectHosts ?? []).map((h) => h.toLowerCase());
  const isRedirect = (u: string) => {
    const h = new URL(u).hostname.toLowerCase();
    return redirectHosts.some((r) => h === r || h.endsWith(`.${r}`));
  };
  const employerUrl = urls.find((u) => !AGGREGATORS.test(new URL(u).hostname) && !isRedirect(u));
  // Redirector-only lists: keep the list's own link (query/fragment dropped, tracking params only) but never treat it as an employer URL.
  const redirectUrl = employerUrl ? undefined : urls.find(isRedirect);
  const redirect = redirectUrl ? Object.assign(new URL(redirectUrl), { search: "", hash: "" }).toString() : undefined;
  const employer = employerUrl;
  if (!employer && !redirect && !closed) return q(urls.length ? "no_employer_url" : "no_apply_url");
  const alternates = [...new Set(urls.filter((u) => u !== employer && u !== redirectUrl))].slice(0, 4);

  const locations = normalizeLocationList(raw.locationLines);
  const geo = deriveGeo(locations);
  const fromTitle = detectSeason(title);
  const season = fromTitle.season ? fromTitle : raw.docSeason;
  const identity = deriveIdentity(employer);
  const requirements = extractRequirements({
    title: raw.educationHint ? `${title} (${raw.educationHint} only)` : title,
    markers,
    remoteRestrictedTo: geo.remoteRestrictedTo,
  });
  const seasonYear = season.year ?? null;
  const row: SnapshotRow = {
    entry_key: "",
    permalink: "",
    row_hash: "",
    company,
    title,
    role_category: categorize(title, raw.section),
    season: season.season ?? null,
    season_year: seasonYear,
    locations,
    country: geo.country,
    work_mode: geo.workMode,
    apply_url: employer ?? redirect ?? null,
    canonical_url: identity.canonicalUrl,
    identity_key: identity.identityKey,
    candidate_key: candidateKey({ company, title, locations, seasonYear }),
    ats_namespace: identity.atsNamespace,
    employer_namespace: identity.employerNamespace,
    requisition_id: identity.requisitionId,
    normalization_version: NORMALIZATION_VERSION,
    requirements,
    source_posted:
      raw.listing?.kind === "date" ? parseListingDate(raw.listing.text) : { year: null, month: null, day: null, precision: "unknown" },
    state: closed ? "source_closed" : "listed",
    alternate_urls: alternates,
    section: raw.section ? raw.section.slice(0, 80) : null,
    listing_text: raw.listing ? raw.listing.text.slice(0, 40) : null,
    listing_kind: raw.listing?.kind ?? null,
    ...(redirect ? { link_kind: "source_redirect" as const } : {}),
  };
  if (Buffer.byteLength(JSON.stringify(row)) > MAX_ROW_BYTES) return q("row_too_large");
  return { row };
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

// Relative ages ("3d") change daily and are excluded from the hash; stated dates are stable and included.
export function hashRow(r: SnapshotRow): string {
  return sha256Hex(
    stable({
      company: r.company,
      title: r.title,
      role_category: r.role_category,
      season: r.season,
      season_year: r.season_year,
      locations: r.locations,
      apply_url: r.apply_url,
      alternate_urls: r.alternate_urls,
      state: r.state,
      requirements: r.requirements,
      work_mode: r.work_mode,
      country: r.country,
      section: r.section,
      listing_date: r.listing_kind === "date" ? r.listing_text : null,
    }),
  );
}

export function finalizeRows(
  built: { row: SnapshotRow; line: number }[],
  ctx: AdapterContext,
): { rows: SnapshotRow[]; duplicates: number } {
  const base = (r: SnapshotRow) =>
    sha256Hex(
      [
        normalizeCompany(r.company),
        normalizeTitle(r.title),
        r.locations.map(normalizeLocation).sort().join(";"),
        `${r.season ?? ""}${r.season_year ?? ""}`,
      ].join("|"),
    ).slice(0, 32);
  const groups = new Map<string, { row: SnapshotRow; line: number }[]>();
  for (const b of built) {
    const k = base(b.row);
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const rows: SnapshotRow[] = [];
  const used = new Set<string>();
  let duplicates = 0;
  for (const [k, members] of groups) {
    for (const [i, { row, line }] of members.entries()) {
      row.row_hash = hashRow(row);
      let key = k;
      if (members.length > 1) key = `${k}:${sha256Hex(row.canonical_url ?? row.apply_url ?? `#${i}`).slice(0, 8)}`;
      if (used.has(key)) {
        const dup = rows.find((x) => x.entry_key === key);
        if (dup && dup.row_hash === row.row_hash) {
          duplicates++;
          continue;
        }
        key = `${key}:${i}`;
        if (used.has(key)) {
          duplicates++;
          continue;
        }
      }
      used.add(key);
      row.entry_key = key;
      row.permalink = `https://github.com/${ctx.owner}/${ctx.repo}/blob/${ctx.commitSha}/${ctx.path}#L${line}`;
      rows.push(row);
    }
  }
  return { rows, duplicates };
}
