import type { SupabaseClient } from "@supabase/supabase-js";
import { seasonLabel } from "@/lib/ui/format";

export const MAX_SEASON_NAME = 30;

/** Canonical stored form: trimmed, single spaces, lowercase. Returns null when empty or invalid. */
export function normalizeSeasonName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!name || name.length > MAX_SEASON_NAME || /[\x00-\x1f]/.test(name)) return null;
  return name;
}

export const seasonKey = (name: string, year: number) => `${name}:${year}`;

export function parseSeasonKey(key: string | null | undefined): { name: string; year: number } | null {
  const m = /^(.+):(\d{4})$/.exec(key ?? "");
  return m ? { name: m[1], year: Number(m[2]) } : null;
}

export interface SeasonTab {
  key: string;
  name: string;
  year: number;
  label: string;
  /** Active applications in this season. */
  n: number;
  /** User-created, empty and not the target season, so its tab can be removed. */
  removable: boolean;
}

export interface SeasonOverview {
  tabs: SeasonTab[]; // target season first, then newest year first
  unclassified: number;
  all: number;
}

// Tabs = target season + seasons the user created + seasons already on their applications (imports, older records).
export async function loadSeasons(supabase: SupabaseClient, target: { season: string; year: number }): Promise<SeasonOverview> {
  const [counts, created] = await Promise.all([
    supabase.from("application_season_counts").select("season, season_year, n"),
    supabase.from("user_seasons").select("name, year"),
  ]);
  const byKey = new Map<string, SeasonTab>();
  const add = (name: string, year: number, n = 0, own = false) => {
    const key = seasonKey(name, year);
    const cur = byKey.get(key);
    if (cur) {
      cur.n += n;
      cur.removable ||= own;
    } else byKey.set(key, { key, name, year, label: seasonLabel(name, year), n, removable: own });
  };
  let unclassified = 0;
  let all = 0;
  for (const r of (counts.data ?? []) as { season: string | null; season_year: number | null; n: number }[]) {
    all += r.n;
    if (!r.season || !r.season_year) unclassified += r.n;
    else add(r.season, r.season_year, r.n);
  }
  for (const r of (created.data ?? []) as { name: string; year: number }[]) add(r.name, r.year, 0, true);
  const targetKey = seasonKey(target.season, target.year);
  if (!byKey.has(targetKey)) add(target.season, target.year);
  const tabs = [...byKey.values()].map((t) => ({ ...t, removable: t.removable && t.n === 0 && t.key !== targetKey }));
  tabs.sort((a, b) => (a.key === targetKey ? -1 : b.key === targetKey ? 1 : b.year - a.year || a.name.localeCompare(b.name)));
  return { tabs, unclassified, all };
}
