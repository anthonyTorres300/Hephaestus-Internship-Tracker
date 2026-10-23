import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, detail, duplicates, readPage } = vi.hoisted(() => ({
  auth: vi.fn(),
  detail: vi.fn(),
  duplicates: vi.fn(),
  readPage: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getWorkspaceForApi: auth }));
vi.mock("@/lib/data/applications", () => ({ getApplicationDetail: detail }));
vi.mock("@/lib/applications/duplicates", () => ({ findApplicationDuplicates: duplicates }));
vi.mock("@/lib/server/public-page", () => ({ readPublicPage: readPage }));
vi.mock("@/lib/server/env", () => ({ getEnv: () => ({ APP_URL: "https://tracker.example.com" }) }));
import { GET } from "@/app/api/applications/[id]/route";
import { POST as preview } from "@/app/api/applications/prefill/route";
import { POST as duplicateCheck } from "@/app/api/applications/duplicates/route";
const id = "00000000-0000-4000-8000-000000000001";
const post = (path: string, body: unknown, origin = "https://tracker.example.com") =>
  new Request(`https://tracker.example.com/api/applications/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
describe("owner-scoped application workflow API", () => {
  beforeEach(() => {
    auth.mockReset().mockResolvedValue({ ctx: { supabase: "owner-client", profile: { timezone: "America/Puerto_Rico" } } });
    detail.mockReset();
    duplicates.mockReset().mockResolvedValue([]);
    readPage.mockReset().mockResolvedValue("<title>Intern</title>");
  });
  it("requires an active workspace for private drawer details and posting previews", async () => {
    auth.mockResolvedValue({ status: 401 });
    expect((await GET(new Request("https://tracker.example.com"), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect((await preview(post("prefill", { url: "https://jobs.example.com/job" }))).status).toBe(401);
    expect(detail).not.toHaveBeenCalled();
    expect(readPage).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing or inaccessible record and marks successful private responses no-store", async () => {
    detail.mockResolvedValue(null);
    expect((await GET(new Request("https://tracker.example.com"), { params: Promise.resolve({ id }) })).status).toBe(404);
    detail.mockResolvedValue({ app: { id }, notes: [{ body: "Private note" }], tasks: [] });
    const response = await GET(new Request("https://tracker.example.com"), { params: Promise.resolve({ id }) });
    expect(detail).toHaveBeenCalledWith("owner-client", id);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(await response.json()).toMatchObject({ timezone: "America/Puerto_Rico", notes: [{ body: "Private note" }] });
  });
  it("rejects cross-origin requests and invalid posting URLs before network access", async () => {
    expect((await preview(post("prefill", { url: "https://example.com" }, "https://foreign.example"))).status).toBe(403);
    expect((await preview(post("prefill", { url: "not a URL" }))).status).toBe(422);
    expect(readPage).not.toHaveBeenCalled();
  });
  it("returns editable suggestions without performing writes", async () => {
    const response = await preview(post("prefill", { url: "https://jobs.example.com/job" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ suggestion: { role_title: "Intern" } });
  });
  it("runs duplicate lookup using the signed-in client's rows", async () => {
    expect((await duplicateCheck(post("duplicates", { company_name: "Example", requisition_id: "R1" }))).status).toBe(200);
    expect(duplicates).toHaveBeenCalledWith("owner-client", { company_name: "Example", requisition_id: "R1" });
  });
});
