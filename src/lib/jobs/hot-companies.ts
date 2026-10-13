import { normalizeCompanyName } from "@/lib/jobs/company-logo";

// Companies students most often chase. Matching is by whole name tokens ("Amazon Web Services" matches Amazon; "Metalenz" does not match Meta).
const HOT: { name: string; aliases?: string[] }[] = [
  { name: "Google", aliases: ["Alphabet", "Google Cloud", "YouTube"] },
  { name: "Amazon", aliases: ["AWS", "Amazon Web Services", "Amazon Robotics"] },
  { name: "Meta", aliases: ["Meta Platforms", "Facebook", "Instagram"] },
  { name: "Apple" },
  { name: "Microsoft" },
  { name: "Nvidia" },
  { name: "Netflix" },
  { name: "Tesla" },
  { name: "SpaceX" },
  { name: "OpenAI" },
  { name: "Anthropic" },
  { name: "Duolingo" },
  { name: "Stripe" },
  { name: "Databricks" },
  { name: "Palantir" },
  { name: "Airbnb" },
  { name: "Uber" },
  { name: "Lyft" },
  { name: "DoorDash" },
  { name: "Instacart" },
  { name: "Pinterest" },
  { name: "Snap", aliases: ["Snapchat"] },
  { name: "Reddit" },
  { name: "Roblox" },
  { name: "Discord" },
  { name: "Figma" },
  { name: "Notion" },
  { name: "Canva" },
  { name: "Adobe" },
  { name: "Salesforce" },
  { name: "LinkedIn" },
  { name: "Oracle" },
  { name: "IBM" },
  { name: "Intel" },
  { name: "AMD" },
  { name: "Qualcomm" },
  { name: "Cisco" },
  { name: "Dropbox" },
  { name: "Coinbase" },
  { name: "Robinhood" },
  { name: "Ramp" },
  { name: "Plaid" },
  { name: "Block", aliases: ["Square", "Cash App"] },
  { name: "Cloudflare" },
  { name: "Datadog" },
  { name: "Snowflake" },
  { name: "MongoDB" },
  { name: "Atlassian" },
  { name: "Shopify" },
  { name: "Spotify" },
  { name: "ByteDance", aliases: ["TikTok"] },
  { name: "Scale AI" },
  { name: "Waymo" },
  { name: "Anduril" },
  { name: "Blue Origin" },
  { name: "Jane Street" },
  { name: "Citadel", aliases: ["Citadel Securities"] },
  { name: "Two Sigma" },
  { name: "Hudson River Trading", aliases: ["HRT"] },
  { name: "Jump Trading" },
  { name: "Optiver" },
  { name: "Susquehanna", aliases: ["SIG"] },
  { name: "DRW" },
  { name: "IMC Trading" },
  { name: "Goldman Sachs" },
  { name: "JPMorgan Chase", aliases: ["JPMorgan", "JP Morgan"] },
  { name: "Capital One" },
  { name: "Bloomberg" },
  { name: "Visa" },
  { name: "Mastercard" },
  { name: "Lockheed Martin" },
  { name: "Northrop Grumman" },
  { name: "Boeing" },
  { name: "RTX", aliases: ["Raytheon", "Collins Aerospace", "Pratt & Whitney"] },
];

const entries = HOT.flatMap((h) =>
  [h.name, ...(h.aliases ?? [])].map((n) => ({ canonical: h.name, tokens: normalizeCompanyName(n).split(" ").filter(Boolean) })),
);

export const HOT_COMPANY_NAMES: readonly string[] = HOT.map((h) => h.name);

/** The canonical hot-company name for a listing's company, or null when it is not one of them. */
export function matchHot(company: string): string | null {
  const tokens = normalizeCompanyName(company).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  let best: { canonical: string; len: number } | null = null;
  for (const e of entries) {
    if (e.tokens.length > tokens.length || e.tokens.length === 0) continue;
    if (e.tokens.every((t, i) => t === tokens[i]) && (!best || e.tokens.length > best.len))
      best = { canonical: e.canonical, len: e.tokens.length };
  }
  return best?.canonical ?? null;
}

export const HOT_COMPANY_MATCHERS = entries.map((e) => ({ canonical: e.canonical, prefix: e.tokens.join(" ") }));
