import { createHash } from "node:crypto";

export const NORMALIZATION_VERSION = "1";

export const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");

const TRACKING_PARAMS = new Set([
  "gclid",
  "gclsrc",
  "dclid",
  "fbclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "igshid",
  "yclid",
  "gh_src",
  "lever-source",
  "lever-origin",
  "lever-via",
  "src_tracking",
  "trk",
  "trackingid",
]);
const KNOWN_TRACKING_VALUES = new Set([
  "simplify",
  "simplifyjobs",
  "github",
  "ghlist",
  "pittcsc",
  "linkedin",
  "indeed",
  "handshake",
  "glassdoor",
  "vansh",
  "ouckah",
  "cvrve",
  "github-vansh-ouckah",
  "newsletter",
  "email",
]);
const SOFT_TRACKING_PARAMS = new Set(["ref", "referrer", "source", "src", "utm", "campaign", "refid", "s"]);
const JOB_PARAM_HINTS =
  /^(gh_jid|jid|jobid|job_id|job|jobreqid|req|reqid|req_id|requisitionid|requisition_id|id|p|pid|postingid|posting_id|jk|vjk|adid|jr_id)$/i;

function parseHttp(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function isTrackingParam(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (JOB_PARAM_HINTS.test(n)) return false;
  if (n.startsWith("utm_") || TRACKING_PARAMS.has(n)) return true;
  if (SOFT_TRACKING_PARAMS.has(n)) return KNOWN_TRACKING_VALUES.has(value.toLowerCase());
  return false;
}

export function canonicalizeUrl(raw: string): string | null {
  const u = parseHttp(raw);
  if (!u || !u.hostname) return null;
  u.username = "";
  u.password = "";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  const kept: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!isTrackingParam(k, v)) kept.push([k, v]);
  });
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const path = u.pathname.replace(/\/{2,}/g, "/");
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const qs = kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const port =
    u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? `:${u.port}` : "";
  return `${u.protocol}//${u.hostname}${port}${trimmed === "/" && !qs ? "" : trimmed}${qs ? `?${qs}` : ""}`;
}

const DASHBOARD_PATH =
  /(^|\/)(userhome|user-home|candidatehome|candidate-home|candidateportal|candidate-portal|my-?profile|my-?applications|myapplications|account|login|log-in|signin|sign-in|signup|register|dashboard|talentcommunity|talent-community|jobalert|job-alert)(\/|$)/i;
const GENERIC_PATH =
  /^\/?(careers?|jobs?|students?|early-?careers?|internships?|university|campus|opportunities|search|openings|en|en-us|home)?(\/(search|home|index(\.html?)?))?\/?$/i;

export function isCandidatePortalUrl(raw: string): boolean {
  const u = parseHttp(raw);
  if (!u) return false;
  return DASHBOARD_PATH.test(u.pathname) || (/(^|\.)(candidate|talent)\./i.test(u.hostname) && u.pathname.length <= 1);
}

// Shared listing/landing pages cannot identify one requisition.
export function isGenericPortalUrl(raw: string): boolean {
  const u = parseHttp(raw);
  if (!u) return false;
  let hasJobParam = false;
  u.searchParams.forEach((_v, k) => {
    if (JOB_PARAM_HINTS.test(k)) hasJobParam = true;
  });
  return !hasJobParam && GENERIC_PATH.test(u.pathname);
}

export interface AtsMatch {
  ats: string;
  tenant: string;
  requisitionId: string;
}

const seg = (p: string) => p.split("/").filter(Boolean);
const ok = (s: string | undefined): s is string => !!s && s.length <= 200;

export function recognizeAts(raw: string): AtsMatch | null {
  const u = parseHttp(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const p = seg(u.pathname);
  const done = (ats: string, tenant?: string, req?: string): AtsMatch | null =>
    ok(tenant) && ok(req) ? { ats, tenant: tenant.toLowerCase(), requisitionId: req } : null;

  if (/^(job-)?boards(\.eu)?\.greenhouse\.io$/.test(host) || host === "boards.greenhouse.io") {
    const i = p.indexOf("jobs");
    return i === 1 && /^\d+$/.test(p[2] ?? "") ? done("greenhouse", p[0], p[2]) : null;
  }
  if (/^jobs(\.eu)?\.lever\.co$/.test(host)) return /^[0-9a-f-]{8,}$/i.test(p[1] ?? "") ? done("lever", p[0], p[1].toLowerCase()) : null;
  if (host === "jobs.ashbyhq.com") return /^[0-9a-f-]{8,}$/i.test(p[1] ?? "") ? done("ashby", p[0], p[1].toLowerCase()) : null;
  if (host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com") {
    const m = /^(\d{6,})/.exec(p[1] ?? "");
    return m ? done("smartrecruiters", p[0], m[1]) : null;
  }
  if (host === "apply.workable.com")
    return p[1] === "j" && /^[0-9A-Za-z]{6,}$/.test(p[2] ?? "") ? done("workable", p[0], p[2].toUpperCase()) : null;
  if (host === "jobs.jobvite.com") return p[1] === "job" ? done("jobvite", p[0], p[2]) : null;
  if (host === "ats.rippling.com") {
    const rest = /^[a-z]{2}(-[a-z]{2})?$/i.test(p[0] ?? "") ? p.slice(1) : p;
    return rest[1] === "jobs" && /^[0-9a-f-]{8,}$/i.test(rest[2] ?? "") ? done("rippling", rest[0], rest[2].toLowerCase()) : null;
  }
  if (host.endsWith(".myworkdayjobs.com")) {
    const sub = host.split(".")[0];
    const j = p.indexOf("job");
    if (j < 1 || j === p.length - 1) return null;
    const last = p[p.length - 1];
    const m = /_([^_]+)$/.exec(last);
    return done("workday", sub, m ? m[1] : last);
  }
  if (host === "wd1.myworkdaysite.com" || /^wd\d+\.myworkdaysite\.com$/.test(host)) {
    const r = p.indexOf("recruiting");
    const j = p.indexOf("job");
    if (r !== 0 || j < 3) return null;
    const last = p[p.length - 1];
    const m = /_([^_]+)$/.exec(last);
    return done("workday", p[1], m ? m[1] : last);
  }
  if (/\.icims\.com$/.test(host)) {
    const tenant = host.split(".")[0].replace(/^careers-/, "");
    return p[0] === "jobs" && /^\d+$/.test(p[1] ?? "") ? done("icims", tenant, p[1]) : null;
  }
  if (/\.fa\.[a-z0-9]+\.oraclecloud\.com$/.test(host)) {
    const j = p.indexOf("job");
    return p.includes("CandidateExperience") && j > 0 && /^\d+$/.test(p[j + 1] ?? "") ? done("oracle", host.split(".")[0], p[j + 1]) : null;
  }
  if (/\.taleo\.net$/.test(host)) {
    const id = u.searchParams.get("job");
    return id && /^[\w-]+$/.test(id) ? done("taleo", host.split(".")[0], id) : null;
  }
  if (/\.bamboohr\.com$/.test(host))
    return p[0] === "careers" && /^\d+$/.test(p[1] ?? "") ? done("bamboohr", host.split(".")[0], p[1]) : null;
  return null;
}

export interface Identity {
  canonicalUrl: string | null;
  identityKey: string | null;
  atsNamespace: string | null;
  employerNamespace: string | null;
  requisitionId: string | null;
}

const NONE: Identity = { canonicalUrl: null, identityKey: null, atsNamespace: null, employerNamespace: null, requisitionId: null };

export function deriveIdentity(rawUrl: string | null | undefined): Identity {
  if (!rawUrl) return NONE;
  const canonical = canonicalizeUrl(rawUrl);
  if (!canonical) return NONE;
  if (isCandidatePortalUrl(rawUrl)) return NONE;
  const ats = recognizeAts(rawUrl);
  if (ats) {
    return {
      canonicalUrl: canonical,
      identityKey: `ats:${ats.ats}:${ats.tenant}:${ats.requisitionId}`,
      atsNamespace: ats.ats,
      employerNamespace: ats.tenant,
      requisitionId: ats.requisitionId,
    };
  }
  if (isGenericPortalUrl(rawUrl)) return { ...NONE, canonicalUrl: canonical };
  return { ...NONE, canonicalUrl: canonical, identityKey: `url:${canonical}` };
}

const COMPANY_SUFFIX = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|lp|llp)\b\.?/g;
const TITLE_WORDS: [RegExp, string][] = [
  [/\binternships?\b/g, "intern"],
  [/\binterns\b/g, "intern"],
  [/\bengineering\b/g, "engineer"],
  [/\bsoftware development engineer\b/g, "software engineer"],
  [/\bco-?ops?\b/g, "coop"],
];

const strip = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function normalizeCompany(s: string): string {
  return strip(s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(COMPANY_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(s: string): string {
  let t = strip(s)
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(summer|fall|winter|spring)\s*'?\s*(20)?\d{2}\b/g, " ")
    .replace(/\b20\d{2}\b/g, " ");
  for (const [re, to] of TITLE_WORDS) t = t.replace(re, to);
  return t
    .replace(/[^a-z0-9+# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLocation(s: string): string {
  return strip(s)
    .replace(/[^a-z0-9 ,]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

export function candidateKey(a: { company: string; title: string; locations: string[]; seasonYear: number | null }): string {
  // Work-mode suffixes ("Austin, TX (Hybrid)") differ between lists for the same job, so they are not part of the key.
  const locs = [
    ...new Set(a.locations.map((l) => normalizeLocation(l.replace(/\s*\((?:remote|hybrid|on-?site)\)\s*$/i, ""))).filter(Boolean)),
  ]
    .sort()
    .join(";");
  return sha256Hex([normalizeCompany(a.company), normalizeTitle(a.title), locs, a.seasonYear ?? ""].join("|")).slice(0, 32);
}
