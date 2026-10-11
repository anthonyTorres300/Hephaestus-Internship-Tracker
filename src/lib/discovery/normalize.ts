export type Season = "summer" | "fall" | "winter" | "spring";
export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export type DegreeLevel = "associate" | "bachelors" | "masters" | "phd";

export interface Requirements {
  graduation_from?: { year: number; month: number };
  graduation_to?: { year: number; month: number };
  degree_levels?: DegreeLevel[];
  graduate_only?: boolean;
  requires_citizenship?: string[];
  requires_us_person?: boolean;
  requires_clearance?: boolean;
  sponsorship_offered?: boolean;
  requires_visa_program?: string;
  remote_restricted_to?: string[];
  skills?: string[];
  evidence?: { text: string };
}

const SEASONS: Record<string, Season> = { summer: "summer", fall: "fall", autumn: "fall", winter: "winter", spring: "spring" };

export function detectSeason(text: string): { season: Season | null; year: number | null } {
  const multi = /\b(?:summer|fall|autumn|winter|spring)\s*[/&,-]\s*(?:summer|fall|autumn|winter|spring)\s*(20\d{2})\b/i.exec(text);
  if (multi) return { season: null, year: Number(multi[1]) };
  const found = new Set<string>();
  const a = /\b(summer|fall|autumn|winter|spring)\s*(?:of\s+)?'?\s*(20\d{2})\b/gi;
  const b = /\b(20\d{2})\s+(summer|fall|autumn|winter|spring)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = a.exec(text))) found.add(`${SEASONS[m[1].toLowerCase()]}:${m[2]}`);
  while ((m = b.exec(text))) found.add(`${SEASONS[m[2].toLowerCase()]}:${m[1]}`);
  if (found.size !== 1) return { season: null, year: null };
  const [s, y] = [...found][0].split(":");
  return { season: s as Season, year: Number(y) };
}

const MARKERS = /[\u{1F6C2}\u{1F512}\u{1F525}\u{1F393}\u23F3⭐️]|\u{1F1FA}\u{1F1F8}/gu;
export const stripMarkers = (s: string) => s.replace(MARKERS, "").replace(/\s+/g, " ").trim();
export const markersIn = (s: string) => ({
  noSponsorship: s.includes("\u{1F6C2}"),
  usCitizenship: s.includes("\u{1F1FA}\u{1F1F8}"),
  advancedDegree: s.includes("\u{1F393}"),
  closed: s.includes("\u{1F512}"),
});

const LOCATION_ALIAS: Record<string, string> = { nyc: "New York, NY", sf: "San Francisco, CA" };
const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR GU VI".split(
    " ",
  ),
);
const CA_PROVINCES = new Set("AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "));

export function normalizeLocationList(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.replace(/\s+/g, " ").trim();
    if (!l || /^\d+\s+locations?$/i.test(l)) continue;
    const v = LOCATION_ALIAS[l.toLowerCase()] ?? l;
    if (v.length > 120) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out.slice(0, 25);
}

function countryOf(loc: string): string | null {
  const l = loc.replace(/\s*\((?:remote|hybrid|on-?site)\)\s*$/i, "").trim();
  // Lowercase two-letter country suffixes ("Ottawa, ON, ca"); uppercase CA is California.
  const cc = /,\s*(us|ca|de|gb|uk|ie|in|sg)$/.exec(l);
  if (cc) return { us: "US", ca: "CA", de: "DE", gb: "GB", uk: "GB", ie: "IE", in: "IN", sg: "SG" }[cc[1]]!;
  if (/\b(usa|u\.s\.a?\.?|united states)\b/i.test(l) || /^us$/i.test(l)) return "US";
  if (
    /\bcanada\b/i.test(l) ||
    /\b(ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b/i.test(l)
  )
    return "CA";
  if (/\b(uk|united kingdom|england)\b/i.test(l)) return "GB";
  if (/\bireland\b/i.test(l)) return "IE";
  if (/\bindia\b/i.test(l)) return "IN";
  if (/\bgermany\b/i.test(l)) return "DE";
  if (/\bsingapore\b/i.test(l)) return "SG";
  const st = /,\s*([A-Z]{2})\b\.?$/.exec(l);
  if (st) {
    if (US_STATES.has(st[1])) return "US";
    if (CA_PROVINCES.has(st[1])) return "CA";
  }
  return null;
}

export function deriveGeo(locations: string[]): { country: string | null; workMode: WorkMode; remoteRestrictedTo?: string[] } {
  const countries = new Set<string>();
  const restricted = new Set<string>();
  let unknownCountry = false;
  let remote = 0;
  let hybrid = 0;
  let onsite = 0;
  let bare = 0; // "US" / "Canada" next to a "Remote" line describes where the remote role is open
  for (const l of locations) {
    const c = countryOf(l);
    const isRemote = /\bremote\b/i.test(l);
    if (c) countries.add(c);
    else if (!/^remote$/i.test(l.trim())) unknownCountry = true;
    if (isRemote) {
      remote++;
      if (c) restricted.add(c);
    } else if (/\bhybrid\b/i.test(l)) hybrid++;
    else if (/\bon-?site\b/i.test(l)) onsite++;
    else if (c && !l.includes(",") && l.trim().split(/\s+/).length <= 2) {
      bare++;
      restricted.add(c);
    }
  }
  const n = locations.length;
  let workMode: WorkMode = "unknown";
  if (n > 0 && remote > 0 && remote + bare === n) workMode = "remote";
  else if (hybrid > 0 && remote === 0) workMode = "hybrid";
  else if (onsite > 0 && onsite === n) workMode = "onsite";
  const country = countries.size === 1 && !unknownCountry ? [...countries][0] : null;
  const rr = workMode === "remote" && restricted.size > 0 ? [...restricted].sort() : undefined;
  return { country, workMode, remoteRestrictedTo: rr };
}

// Strongly non-technical roles stay non-technical even when the title mentions software ("Software Product Management").
const NON_TECH_STRONG = /\b(product (manag|design|market)|program manag|project manag|recruit|human resources|legal)/i;
// Weaker business words ("operations", "tax") do not override an explicit software role ("Operations Software Engineering Intern").
const NON_TECH_WEAK = /\b(marketing|sales|tax|audit|account(ing|ant)|finance analyst|business analyst|operations|consult)/i;
// An explicit software role wins over a specialty named in the same title ("Software Engineer Intern - ML Systems" is software
// engineering; the Jobs page "Software engineering" filter is software/backend/frontend/fullstack).
const SOFTWARE_ROLE =
  /\b(software|swe|sde|sdet|sw engineer\w*|sw dev\w*|developer|programmer|ios|android|mobile (engineer|app\w*)|forward deployed engineer)\b/i;
const SOFTWARE_KIND: [RegExp, string][] = [
  [/\b(back-?end|server)\b/i, "backend"],
  [/\b(front-?end|\bui\b|\bux\b|web developer)/i, "frontend"],
  [/\b(full[- ]?stack)\b/i, "fullstack"],
];

const CATEGORY_RULES: [RegExp, string][] = [
  ...SOFTWARE_KIND,
  [/\b(civil|structural|mechanical|chemical|construction|geotechnical|environmental)\b/i, "other_technical"],
  [/\b(machine learning|\bml\b|\bai\b|artificial intelligence|deep learning|nlp|computer vision|llm|generative)/i, "ai_ml"],
  [/\b(data (scien|engineer|analy)|analytics|data)\b/i, "data"],
  [/\b(robotic|autonom|self-driving|perception)/i, "autonomous_robotics"],
  [
    /\b(embedded|firmware|fpga|asic|rtl|hardware|silicon|verification|circuit|electrical|electronic|analog|mixed[- ]signal|pcb|semiconductor)/i,
    "embedded",
  ],
  [/\b(security|cyber|infosec|appsec|penetration)/i, "security"],
  [/\b(devops|site reliability|\bsre\b|platform engineer|infrastructure)/i, "devops"],
  [/\b(cloud)\b/i, "cloud"],
  [/\b(computer science|application development|web development)\b/i, "software"],
];

const SECTION_CATEGORY: [RegExp, string][] = [
  [/software/i, "software"],
  [/product/i, "non_technical"],
  [/data|ai\b|machine learning/i, "data"],
  [/quant/i, "other_technical"],
  [/hardware/i, "embedded"],
];

export function categorize(title: string, section: string | null): string {
  if (NON_TECH_STRONG.test(title)) return "non_technical";
  const software = SOFTWARE_ROLE.test(title.replace(/software[- ]defined/gi, ""));
  if (!software && NON_TECH_WEAK.test(title)) return "non_technical";
  if (software) {
    for (const [re, cat] of SOFTWARE_KIND) if (re.test(title)) return cat;
    return "software";
  }
  for (const [re, cat] of CATEGORY_RULES) if (re.test(title)) return cat;
  if (section) for (const [re, cat] of SECTION_CATEGORY) if (re.test(section)) return cat;
  return "other_technical";
}

export const EXCLUDED_SECTION = /\b(new[- ]?grad(uate)?s?|full[- ]?time|entry[- ]level)\b/i;

export function extractRequirements(input: {
  title: string;
  markers: ReturnType<typeof markersIn>;
  remoteRestrictedTo?: string[];
}): Requirements {
  const r: Requirements = {};
  const t = input.title;
  const { markers } = input;
  const evidence: string[] = [];
  if (markers.noSponsorship) {
    r.sponsorship_offered = false;
    evidence.push("no sponsorship marker");
  }
  if (markers.usCitizenship) {
    r.requires_citizenship = ["US"];
    evidence.push("US citizenship marker");
  }
  if (markers.advancedDegree) {
    r.graduate_only = true;
    evidence.push("advanced degree marker");
  }

  if (
    /\b(no|not|without)\b[^.,;]{0,25}\bsponsorship\b|\bsponsorship\b[^.,;]{0,20}\b(not (available|offered|provided)|unavailable)\b|does not (offer|provide) (visa )?sponsorship/i.test(
      t,
    )
  ) {
    r.sponsorship_offered = false;
    evidence.push("title: no sponsorship");
  } else if (/\b(visa )?sponsorship (is )?(available|offered|provided)\b/i.test(t)) {
    r.sponsorship_offered = true;
    evidence.push("title: sponsorship available");
  }
  if (/\b(u\.?s\.?|united states)\s+citizen(s|ship)?\b/i.test(t) && !/\bnot\b/i.test(t)) {
    r.requires_citizenship = ["US"];
    evidence.push("title: US citizenship");
  }
  if (/\b(security|secret|top secret|ts\/sci|ts-sci|dod)\s+clearance\b|\bts\/sci\b|\bclearance (required|eligible)\b/i.test(t)) {
    r.requires_clearance = true;
    evidence.push("title: clearance");
  }
  const levels = new Set<DegreeLevel>();
  if (/\bph\.?d\b|\bdoctoral\b/i.test(t)) levels.add("phd");
  if (/\bmaster'?s\b|\bm\.?s\.?\s*\/\s*ph\.?d\b|\bmba\b/i.test(t)) levels.add("masters");
  if (/\bgraduate students? only\b/i.test(t)) {
    levels.add("masters");
    levels.add("phd");
  }
  if (levels.size && !/\bbachelor|\bundergrad/i.test(t)) {
    r.graduate_only = true;
    r.degree_levels = [...levels].sort();
    evidence.push("title: graduate degree");
  }
  const visa = /\b(j-?1|h-?1b|cpt|opt|stem opt)\s+(only|required|students?)\b/i.exec(t);
  if (visa) {
    r.requires_visa_program = visa[1].toUpperCase().replace("-", "");
    evidence.push("title: visa program");
  }
  if (input.remoteRestrictedTo?.length) r.remote_restricted_to = input.remoteRestrictedTo;
  if (evidence.length) r.evidence = { text: evidence.join("; ").slice(0, 200) };
  return r;
}
