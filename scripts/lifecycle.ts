import { runLifecycle } from "../src/lib/discovery/lifecycle";
import { createLifecycleClients } from "./lib/supabase-lifecycle";

async function main(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("lifecycle: SUPABASE_URL and SUPABASE_SECRET_KEY are required");
    return 1;
  }
  const { db, storage, auth } = createLifecycleClients(url, key);
  const s = await runLifecycle({ db, storage, auth, now: () => new Date() });
  console.log(
    `lifecycle: deletions seen=${s.deletionsSeen} completed=${s.deletionsCompleted} failed=${s.deletionsFailed} objects_removed=${s.objectsRemoved}; ` +
      `reservations expired=${s.reservationsExpired} resume_rows_deleted=${s.resumeRowsDeleted}; cleanup=${JSON.stringify(s.cleanup)}`,
  );
  if (s.alerts.length) {
    console.error(
      `lifecycle: ALERT ${s.alerts.length} account deletion request(s) need operator attention (older than 24h or 3+ failed attempts)`,
    );
    for (const a of s.alerts) console.error(`  request=${a.requestId} reason=${a.reason}`);
    return 2;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    const code = (e as { code?: string } | null)?.code;
    console.error(`lifecycle: fatal error${typeof code === "string" ? ` code=${code}` : ""}`);
    process.exit(1);
  },
);
