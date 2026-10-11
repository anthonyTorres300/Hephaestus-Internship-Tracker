import { describe, expect, it, vi } from "vitest";
import { createGithubClient, type FetchFn } from "@/lib/discovery/github";
import { createSourceFetcher } from "@/lib/discovery/fetcher";
import { FETCH_LIMITS } from "@/lib/discovery/sources";
import { DiscoveryError } from "@/lib/discovery/types";

const O = "SimplifyJobs";
const R = "Summer2027-Internships";
const SHA = "b".repeat(40);
const res = (body: string, init: ResponseInit = {}) => new Response(init.status === 304 ? null : body, init);
const make = (fn: FetchFn, extra: Record<string, unknown> = {}) => {
  const sleeps: number[] = [];
  const client = createGithubClient({
    fetch: fn,
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0,
    now: () => 1_000_000,
    ...extra,
  });
  return { client, sleeps };
};
const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as DiscoveryError).code;

describe("allowlist / SSRF", () => {
  const fetch = vi.fn<FetchFn>(async () => res("x"));
  const { client } = make(fetch);
  it("rejects arbitrary hosts, schemes, ports, repos, paths and traversal without fetching", async () => {
    const bad = [
      "https://evil.example.com/x",
      "http://api.github.com/repos/SimplifyJobs/Summer2027-Internships",
      "https://api.github.com:8443/repos/SimplifyJobs/Summer2027-Internships",
      "https://user:pw@api.github.com/repos/SimplifyJobs/Summer2027-Internships",
      "https://api.github.com/repos/other/repo",
      "https://api.github.com/user",
      "https://api.github.com/repos/SimplifyJobs/Summer2027-Internships/contents/x",
      "https://raw.githubusercontent.com/other/repo/main/README.md",
      "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/main/secret.json",
      "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/../x/README.md",
      "https://169.254.169.254/latest/meta-data",
      "https://raw.githubusercontent.com.evil.com/SimplifyJobs/Summer2027-Internships/main/README.md",
      "file:///etc/passwd",
      "not a url",
    ];
    for (const u of bad) expect(["host_not_allowed", "path_not_allowed", "url_invalid"]).toContain(await code(client.request(u)));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("allows configured repo metadata, commits and file", () => {
    expect(() => client.assertAllowed(`https://api.github.com/repos/${O}/${R}`)).not.toThrow();
    expect(() => client.assertAllowed(`https://api.github.com/repos/${O}/${R}/commits/dev`)).not.toThrow();
    expect(() => client.assertAllowed(`https://raw.githubusercontent.com/${O}/${R}/${SHA}/README.md`)).not.toThrow();
  });
});

describe("redirects", () => {
  it("follows allowlisted redirects manually and blocks off-host redirects", async () => {
    const calls: string[] = [];
    const ok = make(async (u, init) => {
      calls.push(u);
      expect(init.redirect).toBe("manual");
      return calls.length === 1
        ? res("", { status: 302, headers: { location: `https://raw.githubusercontent.com/${O}/${R}/${SHA}/README.md` } })
        : res("body");
    });
    expect((await ok.client.request(`https://raw.githubusercontent.com/${O}/${R}/dev/README.md`)).body).toBe("body");
    expect(calls).toHaveLength(2);
    const evil = make(async () => res("", { status: 301, headers: { location: "https://evil.example.com/x" } }));
    expect(await code(evil.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("redirect_blocked");
    const loop = make(async () => res("", { status: 302, headers: { location: `https://api.github.com/repos/${O}/${R}` } }));
    expect(await code(loop.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("too_many_redirects");
  });
});

describe("limits, retries and headers", () => {
  it("rejects oversized bodies by header and while streaming", async () => {
    const a = make(async () => res("x", { headers: { "content-length": String(FETCH_LIMITS.maxBytes + 1) } }));
    expect(await code(a.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("response_too_large");
    const big = new Uint8Array(FETCH_LIMITS.maxBytes + 10);
    const b = make(async () => new Response(big));
    expect(await code(b.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("response_too_large");
  });
  it("retries 5xx and network errors with backoff and gives up after three retries", async () => {
    let n = 0;
    const { client, sleeps } = make(async () => (++n < 3 ? res("", { status: 503 }) : res('{"default_branch":"dev"}')));
    expect((await client.defaultBranch(O, R)).branch).toBe("dev");
    expect(n).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
    let m = 0;
    const dead = make(async () => {
      m++;
      throw new TypeError("fetch failed");
    });
    expect(await code(dead.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("network_error");
    expect(m).toBe(1 + FETCH_LIMITS.maxRetries);
  });
  it("honors Retry-After and rate-limit reset; refuses to wait unreasonably long", async () => {
    let n = 0;
    const a = make(async () => (++n === 1 ? res("", { status: 429, headers: { "retry-after": "7" } }) : res("ok")));
    await a.client.request(`https://api.github.com/repos/${O}/${R}`);
    expect(a.sleeps).toEqual([7000]);
    let k = 0;
    const b = make(async () =>
      ++k === 1 ? res("", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1030" } }) : res("ok"),
    );
    await b.client.request(`https://api.github.com/repos/${O}/${R}`);
    expect(b.sleeps).toEqual([30_000]);
    const c = make(async () => res("", { status: 429, headers: { "retry-after": "3600" } }));
    expect(await code(c.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("rate_limited");
    expect(c.sleeps).toEqual([]);
  });
  it("does not retry client errors; maps 404", async () => {
    let n = 0;
    const a = make(async () => (n++, res("", { status: 404 })));
    expect(await code(a.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("source_not_found");
    const b = make(async () => (n++, res("", { status: 401 })));
    expect(await code(b.client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("http_401");
    expect(n).toBe(2);
  });
  it("sends token and If-None-Match, and surfaces 304", async () => {
    const seen: Record<string, string>[] = [];
    const { client } = make(
      async (_u, init) => {
        seen.push(init.headers as Record<string, string>);
        return res("", { status: 304, headers: { etag: '"abc"' } });
      },
      { token: "tkn" },
    );
    const out = await client.request(`https://api.github.com/repos/${O}/${R}`, { etag: '"abc"' });
    expect(out).toMatchObject({ status: 304, etag: '"abc"' });
    expect(seen[0]["if-none-match"]).toBe('"abc"');
    expect(seen[0].authorization).toBe("Bearer tkn");
  });
  it("times out per attempt", async () => {
    const { client } = make(async (_u, init) => {
      const e = new Error("aborted");
      e.name = (init.signal as AbortSignal) ? "TimeoutError" : "x";
      throw e;
    });
    expect(await code(client.request(`https://api.github.com/repos/${O}/${R}`))).toBe("timeout");
  });
});

describe("source fetcher", () => {
  const route =
    (opts: { fileStatus?: number } = {}): FetchFn =>
    async (u) => {
      if (u.endsWith(`/${R}`)) return res('{"default_branch":"dev","license":null}');
      if (u.includes("/commits/dev")) return res(SHA);
      if (u.includes("raw.githubusercontent.com"))
        return opts.fileStatus === 304 ? res("", { status: 304 }) : res("# README", { headers: { etag: '"new"' } });
      return res("", { status: 500 });
    };
  it("resolves the default branch (never hardcoded) and returns content with commit sha and etag", async () => {
    const f = createSourceFetcher(make(route()).client);
    expect(await f.fetch({ owner: O, repo: R, path: "README.md", etag: null, lastCommitSha: null })).toEqual({
      kind: "content",
      text: "# README",
      commitSha: SHA,
      etag: '"new"',
      defaultBranch: "dev",
    });
  });
  it("skips the download when the head commit is unchanged, and maps 304 to not_modified", async () => {
    const f1 = createSourceFetcher(make(route()).client);
    expect(await f1.fetch({ owner: O, repo: R, path: "README.md", etag: '"e"', lastCommitSha: SHA })).toMatchObject({
      kind: "not_modified",
      commitSha: SHA,
    });
    const f2 = createSourceFetcher(make(route({ fileStatus: 304 })).client);
    expect(await f2.fetch({ owner: O, repo: R, path: "README.md", etag: '"e"', lastCommitSha: "c".repeat(40) })).toMatchObject({
      kind: "not_modified",
      commitSha: SHA,
    });
  });
});
