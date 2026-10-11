export const STATUSES = [
  "saved",
  "prepared",
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
] as const;
export type AppStatus = (typeof STATUSES)[number];

export const IMPORT_REASON = "imported source label";

export interface MappedStatus {
  status: AppStatus;
  reason?: string;
}

export const DEFAULT_STATUS_MAP: Record<string, MappedStatus> = {
  pending: { status: "applied" },
  "screening process": { status: "screening" },
  "offer received": { status: "offer" },
  "not proceeding": { status: "rejected", reason: IMPORT_REASON },
  ghosted: { status: "ghosted" },
  ...Object.fromEntries(STATUSES.map((s) => [s, { status: s }])),
};

export const normalizeLabel = (raw: string) => raw.replace(/\s+/g, " ").trim().toLowerCase();

export interface StatusResult {
  status: AppStatus | null;
  reason?: string;
  needsMapping: boolean;
}

export function mapStatus(raw: string, userMap: Record<string, AppStatus> = {}): StatusResult {
  const key = normalizeLabel(raw);
  const user = Object.entries(userMap).find(([k]) => normalizeLabel(k) === key)?.[1];
  if (user && (STATUSES as readonly string[]).includes(user)) return { status: user, needsMapping: false };
  const d = DEFAULT_STATUS_MAP[key];
  if (d) return { status: d.status, reason: d.reason, needsMapping: false };
  return { status: null, needsMapping: true };
}

export interface StatusLabel extends StatusResult {
  label: string;
  count: number;
}

export function collectStatusLabels(
  table: { rows: string[][] },
  statusIndex: number | null,
  userMap: Record<string, AppStatus> = {},
): StatusLabel[] {
  if (statusIndex === null) return [];
  const seen = new Map<string, StatusLabel>();
  for (const row of table.rows) {
    if (row.every((c) => c.trim() === "")) continue;
    const label = (row[statusIndex] ?? "").trim();
    const key = normalizeLabel(label);
    const hit = seen.get(key);
    if (hit) hit.count++;
    else seen.set(key, { label, count: 1, ...mapStatus(label, userMap) });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
