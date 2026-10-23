import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { dns, https } = vi.hoisted(() => ({ dns: vi.fn(), https: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dns }));
vi.mock("node:https", () => ({ request: https }));
import { readPublicPage } from "@/lib/server/public-page";
type Options = {
  lookup: (host: string, options: unknown, callback: (error: null, address: string, family: number) => void) => void;
  headers: Record<string, string>;
  family: number;
};
type Response = EventEmitter & { statusCode: number; headers: { location?: string }; resume: () => void };
function responses(items: { status?: number; location?: string; body?: string }[]) {
  https.mockImplementation((_: URL, options: Options, callback: (response: Response) => void) => {
    const req = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy(error: Error) {
        req.emit("error", error);
        req.emit("close");
      },
      end() {
        queueMicrotask(() => {
          const item = items.shift() ?? {};
          const response = Object.assign(new EventEmitter(), {
            statusCode: item.status ?? 200,
            headers: { location: item.location },
            resume: () => {},
          });
          callback(response);
          response.emit("data", Buffer.from(item.body ?? ""));
          response.emit("end");
          req.emit("close");
        });
      },
    });
    options.lookup("jobs.example.com", {}, (_, address, family) => {
      expect(address).toBe("8.8.8.8");
      expect(family).toBe(4);
    });
    return req;
  });
}
describe("safe job preview requests", () => {
  beforeEach(() => {
    dns.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    https.mockReset();
  });
  it("pins the validated DNS address and sends no user credentials", async () => {
    responses([{ body: "<title>Internship</title>" }]);
    expect(await readPublicPage("https://jobs.example.com/jobs/123")).toContain("Internship");
    expect(https.mock.calls[0][1]).toMatchObject({ family: 4 });
    expect(https.mock.calls[0][1].headers).not.toHaveProperty("Cookie");
    expect(https.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });
  it("rejects a hostname with any private DNS address before connecting", async () => {
    dns.mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(readPublicPage("https://jobs.example.com/job")).rejects.toThrow("public HTTPS");
    expect(https).not.toHaveBeenCalled();
  });
  it("rechecks every redirect destination and blocks redirects to metadata services", async () => {
    responses([{ status: 302, location: "https://169.254.169.254/credentials" }]);
    await expect(readPublicPage("https://jobs.example.com/job")).rejects.toThrow("public HTTPS");
    expect(https).toHaveBeenCalledTimes(1);
    dns
      .mockReset()
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    responses([{ status: 302, location: "https://redirect.example.com/job" }]);
    await expect(readPublicPage("https://jobs.example.com/job")).rejects.toThrow("public HTTPS");
    expect(https).toHaveBeenCalledTimes(2);
  });
  it("bounds response size and redirect count", async () => {
    responses([{ body: "x".repeat(1024 * 1024 + 1) }]);
    await expect(readPublicPage("https://jobs.example.com/job")).rejects.toThrow("too large");
    responses(Array.from({ length: 4 }, () => ({ status: 302, location: "/job" })));
    await expect(readPublicPage("https://jobs.example.com/job")).rejects.toThrow("Too many");
  });
});
