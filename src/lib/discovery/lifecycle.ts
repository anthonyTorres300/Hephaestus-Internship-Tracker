export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RESUME_BUCKET = "resumes";
const STALE_MS = 24 * 3600 * 1000;
const MAX_RETRIES_BEFORE_ALERT = 3;

export interface DeletionRequest {
  id: string;
  user_id: string;
  state: string;
  requested_at: string;
  retry_count: number;
}

export interface ExpiredReservation {
  resume_id: string;
  user_id: string;
  storage_path: string;
}

export interface StorageEntry {
  name: string;
  id: string | null;
}

export interface LifecycleDb {
  pendingDeletions(limit: number): Promise<DeletionRequest[]>;
  updateDeletion(userId: string, state: string, checkpoints: Record<string, unknown>, error: string | null): Promise<void>;
  expireReservations(): Promise<ExpiredReservation[]>;
  deleteResumeRows(ids: string[]): Promise<number>;
  cleanupOperational(): Promise<Record<string, number>>;
}

export interface LifecycleStorage {
  list(prefix: string, offset: number, limit: number): Promise<StorageEntry[]>;
  remove(paths: string[]): Promise<void>;
}

export interface LifecycleAuth {
  revokeSessions(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export interface LifecycleSummary {
  deletionsSeen: number;
  deletionsCompleted: number;
  deletionsFailed: number;
  objectsRemoved: number;
  reservationsExpired: number;
  resumeRowsDeleted: number;
  cleanup: Record<string, number>;
  alerts: { requestId: string; reason: "stale" | "retries" }[];
}

const safe = (e: unknown): string => {
  const c = e as { code?: unknown; status?: unknown } | null;
  const raw = typeof c?.code === "string" ? c.code : typeof c?.status === "number" ? `http_${c.status}` : "error";
  return raw.replace(/[^a-z0-9_]/gi, "_").slice(0, 40);
};

// Lists every object below `<userId>/` (folders have a null id), bounded in depth and count.
export async function collectUserObjects(storage: LifecycleStorage, userId: string): Promise<string[]> {
  if (!UUID_RE.test(userId)) throw new Error("invalid_user_id");
  const out: string[] = [];
  const walk = async (prefix: string, depth: number): Promise<void> => {
    if (depth > 4) throw new Error("storage_tree_too_deep");
    for (let offset = 0; ; offset += 100) {
      const page = await storage.list(prefix, offset, 100);
      for (const e of page) {
        if (!e.name || e.name.includes("/") || e.name === "." || e.name === "..") continue;
        const full = `${prefix}/${e.name}`;
        if (e.id === null) await walk(full, depth + 1);
        else out.push(full);
        if (out.length > 5000) throw new Error("storage_too_many_objects");
      }
      if (page.length < 100) break;
    }
  };
  await walk(userId, 0);
  return out;
}

export function isOwnedPath(userId: string, path: string): boolean {
  return UUID_RE.test(userId) && path.startsWith(`${userId}/`) && !path.split("/").some((s) => s === ".." || s === "." || s === "");
}

async function removeBatches(storage: LifecycleStorage, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) await storage.remove(paths.slice(i, i + 100));
}

export function findAlerts(pending: DeletionRequest[], now: Date): LifecycleSummary["alerts"] {
  const alerts: LifecycleSummary["alerts"] = [];
  for (const r of pending) {
    if (now.getTime() - Date.parse(r.requested_at) > STALE_MS) alerts.push({ requestId: r.id, reason: "stale" });
    else if (r.retry_count >= MAX_RETRIES_BEFORE_ALERT) alerts.push({ requestId: r.id, reason: "retries" });
  }
  return alerts;
}

export async function runLifecycle(deps: {
  db: LifecycleDb;
  storage: LifecycleStorage;
  auth: LifecycleAuth;
  now: () => Date;
}): Promise<LifecycleSummary> {
  const { db, storage, auth } = deps;
  const s: LifecycleSummary = {
    deletionsSeen: 0,
    deletionsCompleted: 0,
    deletionsFailed: 0,
    objectsRemoved: 0,
    reservationsExpired: 0,
    resumeRowsDeleted: 0,
    cleanup: {},
    alerts: [],
  };

  const pending = await db.pendingDeletions(20);
  s.deletionsSeen = pending.length;
  for (const req of pending) {
    const uid = req.user_id; // always taken from the stored request row
    if (!UUID_RE.test(uid)) {
      s.deletionsFailed++;
      continue;
    }
    let step = "start";
    try {
      step = "sessions";
      await auth.revokeSessions(uid);
      await db.updateDeletion(uid, "in_progress", { sessions_revoked: true }, null);
      step = "storage";
      const objects = await collectUserObjects(storage, uid);
      await removeBatches(storage, objects);
      s.objectsRemoved += objects.length;
      await db.updateDeletion(uid, "storage_cleaned", { storage_cleaned: true, objects_removed: objects.length }, null);
      step = "auth_delete";
      await auth.deleteUser(uid);
      await db.updateDeletion(uid, "completed", { auth_deleted: true }, null).catch(() => undefined);
      s.deletionsCompleted++;
    } catch (e) {
      s.deletionsFailed++;
      await db.updateDeletion(uid, "failed", { last_failed_step: step }, `${step}_${safe(e)}`.slice(0, 64)).catch(() => undefined);
    }
  }

  const expired = await db.expireReservations();
  s.reservationsExpired = expired.length;
  const deletable: string[] = [];
  for (const r of expired) {
    try {
      if (!isOwnedPath(r.user_id, r.storage_path)) continue;
      await storage.remove([r.storage_path]);
      deletable.push(r.resume_id);
    } catch {
      /* row stays; a later pass can retry */
    }
  }
  if (deletable.length) s.resumeRowsDeleted = await db.deleteResumeRows(deletable);

  s.cleanup = await db.cleanupOperational();
  s.alerts = findAlerts(await db.pendingDeletions(100), deps.now());
  return s;
}
