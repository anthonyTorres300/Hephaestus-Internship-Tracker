import type { GithubClient } from "./github";

export interface FetchRequest {
  owner: string;
  repo: string;
  path: string;
  etag: string | null;
  lastCommitSha: string | null;
}

export type FetchOutcome =
  | { kind: "not_modified"; commitSha: string; etag: string | null }
  | { kind: "content"; text: string; commitSha: string; etag: string | null; defaultBranch: string };

export interface SourceFetcher {
  fetch(req: FetchRequest): Promise<FetchOutcome>;
}

export function createSourceFetcher(client: GithubClient): SourceFetcher {
  return {
    async fetch(req) {
      const { branch } = await client.defaultBranch(req.owner, req.repo);
      const sha = await client.headCommit(req.owner, req.repo, branch);
      if (req.etag && req.lastCommitSha === sha) return { kind: "not_modified", commitSha: sha, etag: req.etag };
      const file = await client.file(req.owner, req.repo, sha, req.path, req.etag);
      if (file.status === 304) return { kind: "not_modified", commitSha: sha, etag: file.etag ?? req.etag };
      return { kind: "content", text: file.body, commitSha: sha, etag: file.etag, defaultBranch: branch };
    },
  };
}
