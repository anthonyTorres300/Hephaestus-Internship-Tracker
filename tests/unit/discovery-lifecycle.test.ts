import { describe, expect, it } from "vitest";
import {
  collectUserObjects,
  findAlerts,
  isOwnedPath,
  runLifecycle,
  type DeletionRequest,
  type LifecycleAuth,
  type LifecycleDb,
  type LifecycleStorage,
  type StorageEntry,
} from "@/lib/discovery/lifecycle";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-10T12:00:00Z");
const req = (user: string, extra: Partial<DeletionRequest> = {}): DeletionRequest => ({
  id: `req-${user.slice(0, 2)}`,
  user_id: user,
  state: "queued",
  requested_at: "2026-10-10T08:00:00Z",
  retry_count: 0,
  ...extra,
});

function fake(
  opts: {
    pending?: DeletionRequest[];
    tree?: Record<string, StorageEntry[]>;
    expired?: { resume_id: string; user_id: string; storage_path: string }[];
    failDelete?: string[];
    failStorage?: boolean;
  } = {},
) {
  const calls = {
    updates: [] as unknown[][],
    removed: [] as string[],
    deleted: [] as string[],
    revoked: [] as string[],
    rowsDeleted: [] as string[][],
  };
  const pending = [...(opts.pending ?? [])];
  const db: LifecycleDb = {
    pendingDeletions: async () => pending.filter((p) => !calls.deleted.includes(p.user_id)),
    updateDeletion: async (...a) => void calls.updates.push(a),
    expireReservations: async () => opts.expired ?? [],
    deleteResumeRows: async (ids) => (calls.rowsDeleted.push(ids), ids.length),
    cleanupOperational: async () => ({ rate_limits: 1 }),
  };
  const tree = opts.tree ?? {};
  const storage: LifecycleStorage = {
    list: async (prefix, offset) => (offset === 0 ? (tree[prefix] ?? []) : []),
    remove: async (paths) => {
      if (opts.failStorage) throw new Error("boom");
      calls.removed.push(...paths);
    },
  };
  const auth: LifecycleAuth = {
    revokeSessions: async (u) => void calls.revoked.push(u),
    deleteUser: async (u) => {
      if (opts.failDelete?.includes(u)) throw Object.assign(new Error("x"), { code: "auth_delete_failed" });
      calls.deleted.push(u);
    },
  };
  return { db, storage, auth, calls, run: () => runLifecycle({ db, storage, auth, now: () => NOW }) };
}

describe("lifecycle worker", () => {
  it("removes only the stored user's objects (recursively), then deletes the auth user", async () => {
    const f = fake({
      pending: [req(U1)],
      tree: {
        [U1]: [
          { name: "r1", id: null },
          { name: "r2", id: null },
        ],
        [`${U1}/r1`]: [{ name: "cv.pdf", id: "a" }],
        [`${U1}/r2`]: [{ name: "cv2.pdf", id: "b" }],
      },
    });
    const s = await f.run();
    expect(f.calls.removed).toEqual([`${U1}/r1/cv.pdf`, `${U1}/r2/cv2.pdf`]);
    expect(f.calls.removed.every((p) => p.startsWith(`${U1}/`))).toBe(true);
    expect(f.calls.revoked).toEqual([U1]);
    expect(f.calls.deleted).toEqual([U1]);
    expect(f.calls.updates.map((u) => u[1])).toEqual(["in_progress", "storage_cleaned", "completed"]);
    expect(s).toMatchObject({ deletionsCompleted: 1, deletionsFailed: 0, objectsRemoved: 2, alerts: [] });
  });

  it("never targets a malformed or path-traversing user id taken from data", async () => {
    const f = fake({ pending: [req("../" + U2), req(U2, { id: "ok" })] });
    const s = await f.run();
    expect(f.calls.revoked).toEqual([U2]);
    expect(s.deletionsFailed).toBe(1);
    await expect(collectUserObjects(f.storage, `${U1}/../${U2}`)).rejects.toThrow("invalid_user_id");
    expect(isOwnedPath(U1, `${U2}/x/y.pdf`)).toBe(false);
    expect(isOwnedPath(U1, `${U1}/../${U2}/y.pdf`)).toBe(false);
    expect(isOwnedPath(U1, `${U1}/r/y.pdf`)).toBe(true);
  });

  it("checkpoints failures with a safe code, keeps the auth user, and alerts on retries or age", async () => {
    const f = fake({ pending: [req(U1, { retry_count: 3 })], failStorage: true, tree: { [U1]: [{ name: "x.pdf", id: "1" }] } });
    const s = await f.run();
    expect(f.calls.deleted).toEqual([]);
    const last = f.calls.updates.at(-1)!;
    expect(last[1]).toBe("failed");
    expect(String(last[3])).toMatch(/^storage_/);
    expect(s.alerts).toEqual([{ requestId: "req-11", reason: "retries" }]);
    expect(findAlerts([req(U2, { requested_at: "2026-10-09T08:00:00Z" })], NOW)).toEqual([{ requestId: "req-22", reason: "stale" }]);
    expect(findAlerts([req(U2)], NOW)).toEqual([]);
  });

  it("removes expired reservation objects before deleting rows, only for owned paths", async () => {
    const f = fake({
      expired: [
        { resume_id: "r1", user_id: U1, storage_path: `${U1}/r1/a.pdf` },
        { resume_id: "r2", user_id: U1, storage_path: `${U2}/r2/b.pdf` },
      ],
    });
    const s = await f.run();
    expect(f.calls.removed).toEqual([`${U1}/r1/a.pdf`]);
    expect(f.calls.rowsDeleted).toEqual([["r1"]]);
    expect(s).toMatchObject({ reservationsExpired: 2, resumeRowsDeleted: 1, cleanup: { rate_limits: 1 } });
  });

  it("keeps rows when storage removal fails", async () => {
    const f = fake({ expired: [{ resume_id: "r1", user_id: U1, storage_path: `${U1}/r1/a.pdf` }], failStorage: true });
    const s = await f.run();
    expect(f.calls.rowsDeleted).toEqual([]);
    expect(s.resumeRowsDeleted).toBe(0);
  });
});
