// Where a company's logo might come from: the employer's own site if the apply link is on it, else a guess from the name.
const JOB_BOARD_SUFFIXES = [
  "jobright.ai",
  "zapply.jobs",
  "dreamworkhq.com",
  "ripplematch.com",
  "wellfound.com",
  "ziprecruiter.com",
  "builtin.com",
  "otta.com",
  "welcometothejungle.com",
  "jobs.ashbyhq.com",
  "notion.site",
  "airtable.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "myworkdaysite.com",
  "workday.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "workable.com",
  "jobvite.com",
  "taleo.net",
  "oraclecloud.com",
  "successfactors.com",
  "successfactors.eu",
  "bamboohr.com",
  "breezy.hr",
  "recruitee.com",
  "applytojob.com",
  "paylocity.com",
  "ultipro.com",
  "adp.com",
  "dayforcehcm.com",
  "eightfold.ai",
  "phenompeople.com",
  "avature.net",
  "brassring.com",
  "jobs.lever.co",
  "rippling.com",
  "gem.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "handshake.com",
  "joinhandshake.com",
  "simplify.jobs",
  "applyguy.ai",
  "github.com",
  "githubusercontent.com",
  "bit.ly",
  "tinyurl.com",
  "forms.gle",
  "google.com/forms",
];

const NAME_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "plc",
  "lp",
  "llp",
  "gmbh",
  "the",
]);

// A handful of well-known names whose site is not simply <name>.com.
const OVERRIDES: Record<string, string> = {
  aws: "aws.amazon.com",
  "amazon web services": "aws.amazon.com",
  alphabet: "abc.xyz",
  "bank of america": "bankofamerica.com",
  "jp morgan": "jpmorganchase.com",
  jpmorgan: "jpmorganchase.com",
  "jpmorgan chase": "jpmorganchase.com",
  jpmorganchase: "jpmorganchase.com",
  "d e shaw": "deshaw.com",
  "de shaw": "deshaw.com",
  "hudson river trading": "hudsonrivertrading.com",
  hrt: "hudsonrivertrading.com",
  "two sigma": "twosigma.com",
  "goldman sachs": "goldmansachs.com",
  "morgan stanley": "morganstanley.com",
  "capital one": "capitalone.com",
  "bae systems": "baesystems.com",
  "northrop grumman": "northropgrumman.com",
  "lockheed martin": "lockheedmartin.com",
  "general dynamics": "gd.com",
  raytheon: "rtx.com",
  rtx: "rtx.com",
  "collins aerospace": "collinsaerospace.com",
  l3harris: "l3harris.com",
  "us bank": "usbank.com",
};

const isJobBoard = (host: string) => JOB_BOARD_SUFFIXES.some((s) => !s.includes("/") && (host === s || host.endsWith("." + s)));

function registrable(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoLevel = new Set(["co", "com", "org", "net", "ac", "gov"]);
  const last2 = parts.slice(-2);
  return twoLevel.has(last2[0]) && last2[1].length === 2 ? parts.slice(-3).join(".") : last2.join(".");
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NAME_SUFFIXES.has(w))
    .join(" ")
    .trim();
}

export function logoDomainCandidates(company: string, applyUrl?: string | null): string[] {
  const out: string[] = [];
  if (applyUrl) {
    try {
      const host = new URL(applyUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (host && !isJobBoard(host)) out.push(registrable(host));
    } catch {
      // ignore malformed links
    }
  }
  const norm = normalizeCompanyName(company);
  if (norm) {
    const override = OVERRIDES[norm];
    if (override) out.unshift(override);
    const guess = norm.replace(/ /g, "");
    if (guess.length >= 2 && guess.length <= 40) out.push(`${guess}.com`);
  }
  return [...new Set(out)].slice(0, 3);
}

export const logoUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
