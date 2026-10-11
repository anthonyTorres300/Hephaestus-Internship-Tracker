import { createClient } from "@supabase/supabase-js";
import {
  RESUME_BUCKET,
  type DeletionRequest,
  type ExpiredReservation,
  type LifecycleAuth,
  type LifecycleDb,
  type LifecycleStorage,
} from "../../src/lib/discovery/lifecycle";

class RpcError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function createLifecycleClients(url: string, secretKey: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname)) throw new Error("SUPABASE_URL must be https");
  const sb = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new RpcError(error.code || "rpc_error");
    return data as T;
  };

  const db: LifecycleDb = {
    pendingDeletions: async (limit) => (await rpc<DeletionRequest[]>("lifecycle_pending_deletions", { p_limit: limit })) ?? [],
    updateDeletion: async (userId, state, checkpoints, error) => {
      await rpc("lifecycle_update_deletion", { p_user: userId, p_state: state, p_checkpoints: checkpoints, p_error: error });
    },
    expireReservations: async () => (await rpc<ExpiredReservation[]>("lifecycle_expire_reservations")) ?? [],
    deleteResumeRows: async (ids) => Number(await rpc<number>("lifecycle_delete_resume_rows", { p_ids: ids })),
    cleanupOperational: async () => (await rpc<Record<string, number>>("lifecycle_cleanup_operational")) ?? {},
  };

  const bucket = sb.storage.from(RESUME_BUCKET);
  const storage: LifecycleStorage = {
    async list(prefix, offset, limit) {
      const { data, error } = await bucket.list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new RpcError("storage_list_failed");
      return (data ?? []).map((e) => ({ name: e.name, id: e.id ?? null }));
    },
    async remove(paths) {
      const { error } = await bucket.remove(paths);
      if (error) throw new RpcError("storage_remove_failed");
    },
  };

  const auth: LifecycleAuth = {
    async revokeSessions(userId) {
      const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (error && error.status !== 404) throw new RpcError("auth_revoke_failed");
    },
    async deleteUser(userId) {
      const { error } = await sb.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new RpcError("auth_delete_failed");
    },
  };
  return { db, storage, auth };
}
