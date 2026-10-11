import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/data/types";
import { fetchCandidateJobs } from "@/lib/jobs/feed";

// Minimal fake of the PostgREST query builder: records filters, serves rows in pages capped at 1,000 like a real project.
function fakeSupabase(rows: Record<string, unknown>[]) {
  const calls: Record<string, unknown[]>[] = [];
  const client = {
    from() {
      const filters: Record<string, unknown[]> = {};
      const b: Record<string, unknown> = {};
      const rec =
        (k: string) =>
        (...a: unknown[]) => {
          (filters[k] ??= []).push(a);
          return b;
        };
      for (const k of ["select", "is", "neq", "eq", "or", "in", "gte", "order"]) b[k] = rec(k);
      b.range = (from: number, to: number) => {
        calls.push(filters);
        let data = rows;
        for (const [col, v] of (filters.eq ?? []) as [string, unknown][]) data = data.filter((r) => r[col] === v);
        const inn = (filters.in ?? [])[0] as [string, string[]] | undefined;
        if (inn) data = data.filter((r) => inn[1].includes(r[inn[0]] as string));
        return Promise.resolve({ data: data.slice(from, Math.min(to, from + 999) + 1), error: null });
      };
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const profile = { target_season: "summer", target_year: 2027 } as Profile;

describe("jobs feed candidate loading", () => {
  it("pages past the 1,000-row cap and keeps old matching jobs when many newer non-matching ones exist", async () => {
    // 2,200 newer listings that do NOT match (wrong season) followed by 120 older Summer 2027 software jobs.
    const rows = [
      ...Array.from({ length: 2200 }, (_, i) => ({ id: `n${i}`, season: "fall", season_year: 2026, role_category: "software" })),
      ...Array.from({ length: 120 }, (_, i) => ({ id: `o${i}`, season: "summer", season_year: 2027, role_category: "software" })),
    ];
    const { client } = fakeSupabase(rows);
    const out = await fetchCandidateJobs(client, profile, { season: "target", role: "swe" });
    expect(out).toHaveLength(120);
    expect(out.every((j) => (j as unknown as { season: string }).season === "summer")).toBe(true);
  });

  it("requests every page when more than 1,000 rows match", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, season: "summer", season_year: 2027, role_category: "backend" }));
    const { client, calls } = fakeSupabase(rows);
    const out = await fetchCandidateJobs(client, profile, { season: "target", role: "swe" });
    expect(out).toHaveLength(2500);
    expect(calls).toHaveLength(3);
  });

  it("applies season, role group and the first-seen cutoff in the query", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchCandidateJobs(client, profile, { season: "target", role: "swe", firstSeenAfter: "2026-10-01T00:00:00Z" });
    const f = calls[0];
    expect(f.eq).toEqual(
      expect.arrayContaining([
        ["season", "summer"],
        ["season_year", 2027],
      ]),
    );
    expect((f.in as [string, string[]][])[0][1]).toEqual(["software", "backend", "frontend", "fullstack"]);
    expect(f.gte).toEqual([["first_seen_at", "2026-10-01T00:00:00Z"]]);
    expect(f.neq).toEqual([["availability", "source_closed"]]); // listings marked closed in the GitHub list never reach the feed
  });

  it("does not filter by role for 'everything' and uses the unknown-season filter on request", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchCandidateJobs(client, profile, { season: "unknown", role: "all" });
    expect(calls[0].in).toBeUndefined();
    expect(calls[0].or).toEqual([["season.is.null,season_year.is.null"]]);
  });
});
