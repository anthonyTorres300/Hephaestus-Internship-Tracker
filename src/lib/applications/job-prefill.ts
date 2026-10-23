import type { JobSuggestion } from "./types";
const decode = (value: string) =>
  value
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code: string) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? decode(value)
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max) || undefined
    : undefined;
function posting(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      const found = posting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const object = value as Record<string, unknown>;
  if (object["@type"] === "JobPosting" || (Array.isArray(object["@type"]) && object["@type"].includes("JobPosting"))) return object;
  return posting(object["@graph"], depth + 1);
}
export function extractJobSuggestion(html: string, url: string): JobSuggestion {
  let job: Record<string, unknown> | null = null;
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].slice(0, 100);
  for (const [, attrs, content] of scripts) {
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    try {
      job = posting(JSON.parse(content));
    } catch {
      /* Some sites HTML-escape JSON-LD. */ try {
        job = posting(JSON.parse(decode(content)));
      } catch {}
    }
    if (job) break;
  }
  const metadata = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map([...tag.matchAll(/([a-z_:]+)\s*=\s*(["'])(.*?)\2/gi)].map(([, name, , value]) => [name.toLowerCase(), value]));
    const name = attrs.get("property") ?? attrs.get("name");
    if (name && attrs.get("content")) metadata.set(name.toLowerCase(), attrs.get("content")!);
  }
  const organization = job?.hiringOrganization as { name?: unknown } | undefined;
  const identifier = job?.identifier;
  const identifierValue = identifier && typeof identifier === "object" ? (identifier as { value?: unknown }).value : identifier;
  const rawLocations = job?.jobLocation ? (Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation]) : [];
  const locations = rawLocations
    .slice(0, 20)
    .map((location) => {
      const address = (location as { address?: unknown })?.address;
      if (typeof address === "string") return text(address, 100);
      if (!address || typeof address !== "object") return undefined;
      const a = address as Record<string, unknown>;
      return text(
        [
          a.addressLocality,
          a.addressRegion,
          typeof a.addressCountry === "object" ? (a.addressCountry as { name?: unknown })?.name : a.addressCountry,
        ]
          .filter((item) => typeof item === "string" && item)
          .join(", "),
        100,
      );
    })
    .filter((location): location is string => !!location);
  const parsed = new URL(url);
  const queryId = [...parsed.searchParams].find(([key]) =>
    /^(gh_jid|jobid|job_id|requisitionid|requisition_id|reqid|req_id|jobreqid)$/i.test(key),
  )?.[1];
  const pathId = /\/(?:jobs?|requisitions?)\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(parsed.pathname)?.[1];
  return {
    company_name: text(organization?.name ?? metadata.get("og:site_name"), 200),
    role_title: text(job?.title ?? metadata.get("og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 300),
    ...(locations.length
      ? { locations: [...new Set(locations)] }
      : job?.jobLocationType === "TELECOMMUTE"
        ? { locations: ["Remote"] }
        : {}),
    requisition_id: text(
      (typeof identifierValue === "number" && Number.isFinite(identifierValue) ? String(identifierValue) : identifierValue) ??
        queryId ??
        (pathId && /^(?:[0-9]{3,}|[a-f0-9]{8}-[a-f0-9-]{27}|R[-_]?[0-9]{3,})$/i.test(pathId) ? pathId : undefined),
      100,
    ),
  };
}
