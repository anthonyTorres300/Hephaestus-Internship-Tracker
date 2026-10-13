import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireWorkspace: async () => ({ supabase: { rpc }, profile: { timezone: "America/Puerto_Rico" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import { createApplicationAction } from "@/app/(app)/applications/actions";

function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ company_name: "Example", role_title: "SWE Intern", idem: "test-operation-key", ...extra }))
    fd.set(key, value);
  return fd;
}

describe("application entry defaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T02:00:00Z"));
    rpc.mockReset().mockResolvedValue({ data: { id: "new-id" }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("records Applied today in the profile timezone without an extra attestation step", async () => {
    await expect(createApplicationAction({}, form())).rejects.toThrow("redirect:/applications/new-id");
    expect(rpc.mock.calls[0][1].p).toMatchObject({
      status: "applied",
      attested: true,
      submitted_precision: "day",
      submitted_year: 2026,
      submitted_month: 10,
      submitted_day: 12,
    });
  });

  it("preserves an explicitly changed date", async () => {
    await expect(createApplicationAction({}, form({ submitted_day: "2026-10-09" }))).rejects.toThrow("redirect:");
    expect(rpc.mock.calls[0][1].p.submitted_day).toBe(9);
  });

  it("preserves unknown dates and unsubmitted statuses when explicitly chosen", async () => {
    await expect(createApplicationAction({}, form({ date_known: "unknown" }))).rejects.toThrow("redirect:");
    expect(rpc.mock.calls[0][1].p).toMatchObject({ submitted_precision: "unknown", submission_date_unknown: true });
    await expect(createApplicationAction({}, form({ status: "prepared" }))).rejects.toThrow("redirect:");
    expect(rpc.mock.calls[1][1].p).toMatchObject({ status: "prepared", attested: false });
  });

  it("rejects invalid dates before writing", async () => {
    expect(await createApplicationAction({}, form({ submitted_day: "2026-02-30" }))).toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
