import { describe, expect, it } from "vitest";
import { createDb, createUser } from "./harness";

describe("migrations", () => {
  it("apply cleanly and bootstrap an account on signup", async () => {
    const db = await createDb();
    const uid = await createUser(db, "a@example.test", { termsVersion: "2026-10" });
    const s = await db.query("select state from public.account_states where user_id = $1", [uid]);
    expect(s.rows[0]).toEqual({ state: "active" });
    const p = await db.query("select count(*)::int n from public.profiles where user_id = $1", [uid]);
    expect(p.rows[0]).toEqual({ n: 1 });
    const acc = await db.query("select version from public.policy_acceptances where user_id = $1", [uid]);
    expect(acc.rows[0]).toEqual({ version: "2026-10" });
  });
});
