import { beforeEach, describe, expect, it, vi } from "vitest";
const { setUserJob, revalidatePath } = vi.hoisted(() => ({ setUserJob: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireWorkspace: async () => ({ supabase: {}, user: { id: "owner" } }) }));
vi.mock("@/lib/jobs/feed", () => ({ setUserJob }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { toggleHideAction, toggleSaveAction } from "@/app/(app)/jobs/actions";
const fd = () => {
  const f = new FormData();
  f.set("job_id", "00000000-0000-4000-8000-000000000001");
  f.set("value", "true");
  return f;
};
beforeEach(() => {
  vi.clearAllMocks();
});
describe("job toggles", () => {
  it.each([toggleSaveAction, toggleHideAction])("reports write failures without claiming success", async (action) => {
    setUserJob.mockResolvedValue({ message: "database unavailable" });
    expect(await action(fd())).toMatchObject({ ok: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("invalidates both list and details only after successful writes", async () => {
    setUserJob.mockResolvedValue(null);
    expect(await toggleSaveAction(fd())).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/jobs");
    expect(revalidatePath).toHaveBeenCalledWith("/jobs/00000000-0000-4000-8000-000000000001");
  });
});
