import { ALLOWED_HOSTS, FETCH_LIMITS, SOURCES, type SourceConfig } from "./sources";
import { DiscoveryError } from "./types";

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface ClientOptions {
  fetch?: FetchFn;
  token?: string | null;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  allowed?: readonly Pick<SourceConfig, "owner" | "repo" | "path">[];
}

export interface HttpResult {
  status: number;
  body: string;
  etag: string | null;
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

export function createGithubClient(opts: ClientOptions = {}) {
  const doFetch: FetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;
  const allowed = opts.allowed ?? SOURCES;

  const isAllowedRepo = (o: string, r: string) => allowed.some((s) => s.owner === o && s.repo === r);

  // Strict allowlist: https only, two hosts, and only paths belonging to a configured owner/repo/file.
  function assertAllowed(raw: string): URL {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new DiscoveryError("url_invalid");
    }
    if (u.protocol !== "https:" || u.username || u.password || u.port) throw new DiscoveryError("host_not_allowed");
    if (!(ALLOWED_HOSTS as readonly string[]).includes(u.hostname)) throw new DiscoveryError("host_not_allowed");
    const p = u.pathname.split("/").filter(Boolean);
    if (p.some((s) => s === ".." || s === ".")) throw new DiscoveryError("path_not_allowed");
    if (u.hostname === "api.github.com") {
      const repoOnly = p[0] === "repos" && p.length === 3;
      const commit = p[0] === "repos" && p.length === 5 && p[3] === "commits" && SEGMENT.test(p[4]);
      if (!(repoOnly || commit) || !isAllowedRepo(p[1], p[2])) throw new DiscoveryError("path_not_allowed");
    } else {
      const [o, r, ref, ...rest] = p;
      const path = rest.join("/");
      if (!o || !r || !ref || !isAllowedRepo(o, r) || !allowed.some((s) => s.owner === o && s.repo === r && s.path === path)) {
        throw new DiscoveryError("path_not_allowed");
      }
      if (!SEGMENT.test(ref)) throw new DiscoveryError("path_not_allowed");
    }
    return u;
  }

  function retryDelayMs(res: Response | null, attempt: number): number | null {
    const backoff = 500 * 2 ** attempt;
    const jitter = Math.floor(random() * 250);
    let wait = backoff + jitter;
    if (res) {
      const ra = res.headers.get("retry-after");
      if (ra) {
        const secs = Number(ra);
        const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(ra) - now();
        if (Number.isFinite(ms)) wait = Math.max(wait, ms + jitter);
      } else if (res.headers.get("x-ratelimit-remaining") === "0") {
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        if (Number.isFinite(reset)) wait = Math.max(wait, reset * 1000 - now() + jitter);
      }
    }
    return wait > FETCH_LIMITS.maxWaitMs ? null : Math.max(0, wait);
  }

  async function readCapped(res: Response): Promise<string> {
    const len = Number(res.headers.get("content-length"));
    if (Number.isFinite(len) && len > FETCH_LIMITS.maxBytes) {
      await res.body?.cancel().catch(() => undefined);
      throw new DiscoveryError("response_too_large");
    }
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > FETCH_LIMITS.maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new DiscoveryError("response_too_large");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
  }

  async function once(start: URL, headers: Record<string, string>): Promise<Response> {
    let url = start;
    for (let hop = 0; ; hop++) {
      const res = await doFetch(url.toString(), {
        method: "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs),
      });
      if (res.status >= 300 && res.status < 400 && res.status !== 304) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!loc || hop >= FETCH_LIMITS.maxRedirects) throw new DiscoveryError(loc ? "too_many_redirects" : "redirect_invalid");
        try {
          url = assertAllowed(new URL(loc, url).toString());
        } catch {
          throw new DiscoveryError("redirect_blocked");
        }
        continue;
      }
      return res;
    }
  }

  async function request(rawUrl: string, o: { etag?: string | null; accept?: string } = {}): Promise<HttpResult> {
    const url = assertAllowed(rawUrl);
    const headers: Record<string, string> = {
      accept: o.accept ?? "application/vnd.github+json",
      "user-agent": "hephaestus-discovery",
      "x-github-api-version": "2022-11-28",
    };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (o.etag) headers["if-none-match"] = o.etag;
    if (url.hostname === "raw.githubusercontent.com") delete headers["x-github-api-version"];

    let lastCode = "network_error";
    for (let attempt = 0; attempt <= FETCH_LIMITS.maxRetries; attempt++) {
      let res: Response | null = null;
      try {
        res = await once(url, headers);
      } catch (e) {
        if (e instanceof DiscoveryError) throw e;
        lastCode = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError" ? "timeout" : "network_error";
      }
      if (res) {
        if (res.status === 304) return { status: 304, body: "", etag: res.headers.get("etag") ?? o.etag ?? null };
        if (res.ok) return { status: res.status, body: await readCapped(res), etag: res.headers.get("etag") };
        const limited =
          res.status === 429 ||
          (res.status === 403 && (res.headers.has("retry-after") || res.headers.get("x-ratelimit-remaining") === "0"));
        if (res.status === 404) {
          await res.body?.cancel().catch(() => undefined);
          throw new DiscoveryError("source_not_found");
        }
        lastCode = limited ? "rate_limited" : `http_${res.status}`;
        const retryable = limited || res.status >= 500;
        if (!retryable) {
          await res.body?.cancel().catch(() => undefined);
          throw new DiscoveryError(lastCode);
        }
        const wait = retryDelayMs(res, attempt);
        await res.body?.cancel().catch(() => undefined);
        if (wait === null) throw new DiscoveryError("rate_limited");
        if (attempt < FETCH_LIMITS.maxRetries) await sleep(wait);
        continue;
      }
      const wait = retryDelayMs(null, attempt);
      if (attempt < FETCH_LIMITS.maxRetries) await sleep(wait ?? 0);
    }
    throw new DiscoveryError(lastCode);
  }

  return {
    request,
    assertAllowed,
    async defaultBranch(owner: string, repo: string): Promise<{ branch: string; license: string | null }> {
      const r = await request(`https://api.github.com/repos/${owner}/${repo}`);
      const d = parseJson(r.body);
      const branch = typeof d?.default_branch === "string" ? d.default_branch : "";
      if (!SEGMENT.test(branch)) throw new DiscoveryError("default_branch_unresolved");
      return { branch, license: typeof d?.license?.spdx_id === "string" ? d.license.spdx_id : null };
    },
    async headCommit(owner: string, repo: string, branch: string): Promise<string> {
      const r = await request(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`, {
        accept: "application/vnd.github.sha",
      });
      const sha = r.body.trim();
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new DiscoveryError("commit_unresolved");
      return sha;
    },
    async file(owner: string, repo: string, sha: string, path: string, etag: string | null): Promise<HttpResult> {
      return request(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`, { etag, accept: "text/plain" });
    },
  };
}

export type GithubClient = ReturnType<typeof createGithubClient>;

function parseJson(s: string): { default_branch?: unknown; license?: { spdx_id?: unknown } | null } | null {
  try {
    return JSON.parse(s);
  } catch {
    throw new DiscoveryError("response_invalid");
  }
}
