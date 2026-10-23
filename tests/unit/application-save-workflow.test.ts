import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, duplicates, maybeSingle } = vi.hoisted(() => ({ rpc: vi.fn(), duplicates: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireWorkspace: async () => ({
    supabase: { rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
    profile: { timezone: "America/Puerto_Rico" },
  }),
}));
vi.mock("@/lib/applications/duplicates", () => ({ findApplicationDuplicates: duplicates }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { saveApplicationAction, confirmSubmissionAction } from "@/app/(app)/applications/actions";
function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({
    company_name: "Example",
    role_title: "SWE Intern",
    idem: "workflow-operation-key",
    submitted_day: "2026-10-13",
    ...extra,
  }))
    fd.set(key, value);
  return fd;
}
describe("saving applications without navigation", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { id: "saved-id" }, error: null });
    duplicates.mockReset().mockResolvedValue([]);
    maybeSingle.mockReset();
  });
  it("returns the saved ID using the existing atomic create RPC", async () => {
    expect(await saveApplicationAction({}, form())).toMatchObject({ status: "ok", applicationId: "saved-id" });
    expect(rpc).toHaveBeenCalledWith(
      "create_application",
      expect.objectContaining({
        p_key: "workflow-operation-key",
        p: expect.objectContaining({ status: "applied", submitted_day: 13, attested: true }),
      }),
    );
  });
  it("does not write a possible duplicate until the user confirms a separate entry", async () => {
    duplicates.mockResolvedValue([
      { id: "existing", company_name: "Example", role_title: "SWE Intern", status: "applied", reason: "Same application link" },
    ]);
    expect(await saveApplicationAction({}, form())).toMatchObject({
      status: "error",
      duplicates: [expect.objectContaining({ id: "existing" })],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(await saveApplicationAction({}, form({ allow_duplicate: "on" }))).toMatchObject({ status: "ok" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("handles a duplicate lookup failure without writing or throwing away input", async () => {
    duplicates.mockRejectedValue(new Error("database unavailable"));
    expect(await saveApplicationAction({}, form())).toMatchObject({ status: "error", values: { company_name: "Example" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires a valid date and explicit confirmation for return-from-applying updates", async () => {
    expect(await confirmSubmissionAction({}, form())).toMatchObject({ status: "error" });
    expect(
      await confirmSubmissionAction(
        {},
        form({ application_id: "00000000-0000-4000-8000-000000000001", attested: "on", submitted_day: "2026-02-30" }),
      ),
    ).toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("updates the existing saved record after explicit submission confirmation", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    maybeSingle.mockResolvedValue({ data: { id, status: "saved", revision: 1, trashed_at: null } });
    rpc.mockResolvedValue({ data: { revision: 2, status: "applied" }, error: null });
    expect(await confirmSubmissionAction({}, form({ application_id: id, attested: "on", submitted_day: "2026-10-09" }))).toMatchObject({
      status: "ok",
      applicationId: id,
    });
    expect(rpc).toHaveBeenCalledWith(
      "change_application_status",
      expect.objectContaining({
        p_application_id: id,
        p_expected_revision: 1,
        p_new_status: "applied",
        p_attested: true,
        p_submitted: { precision: "day", year: 2026, month: 10, day: 9 },
      }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not create a second application or change status when an existing record is already submitted", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000001", status: "interview", revision: 2, trashed_at: null },
    });
    expect(
      await confirmSubmissionAction({}, form({ application_id: "00000000-0000-4000-8000-000000000001", attested: "on" })),
    ).toMatchObject({ status: "ok", applicationId: "00000000-0000-4000-8000-000000000001" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
