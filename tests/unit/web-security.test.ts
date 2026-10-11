import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";
import { dbErrorStatus } from "@/lib/server/http";
import { leetcodeSlug } from "@/lib/validation/practice";
import { parseSubmission } from "@/lib/validation/application";
import { splitList } from "@/lib/validation/common";

describe("safeNextPath (AC-01/AC-18: no open redirects)", () => {
  it.each([
    ["https://evil.example/x", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/unknown-section", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
    ["/dashboard\r\nLocation: x", "/dashboard"],
  ])("rejects %s", (input, out) => expect(safeNextPath(input as string | null)).toBe(out));
  it("allows local app paths with queries", () => {
    expect(safeNextPath("/applications/abc?x=1")).toBe("/applications/abc?x=1");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });
});

describe("dbErrorStatus", () => {
  it("maps RPC SQLSTATEs to HTTP statuses without leaking SQL", () => {
    expect(dbErrorStatus({ code: "PT409", message: "revision_conflict" })).toMatchObject({ status: 409, code: "revision_conflict" });
    expect(dbErrorStatus({ code: "PT429", message: "quota_exceeded: applications" })).toMatchObject({
      status: 429,
      code: "quota_exceeded",
    });
    expect(dbErrorStatus({ code: "42501" }).status).toBe(403);
    expect(dbErrorStatus({ code: "23503" }).status).toBe(409);
    const unknown = dbErrorStatus({ code: "XX000", message: 'relation "secret_table" does not exist' });
    expect(unknown.status).toBe(500);
    expect(unknown.message).not.toMatch(/secret_table/);
  });
});

describe("form parsing helpers", () => {
  it("parses submission precision without inventing days", () => {
    expect(parseSubmission("month", undefined, "2024-09").value).toMatchObject({
      submitted_precision: "month",
      submitted_year: 2024,
      submitted_month: 9,
    });
    expect(parseSubmission("month", undefined, "2024-09").value).not.toHaveProperty("submitted_day");
    expect(parseSubmission("day", "2026-10-09", undefined).value).toMatchObject({ submitted_precision: "day", submitted_day: 9 });
    expect(parseSubmission("day", "2026-02-30", undefined).error).toBeTruthy();
    expect(parseSubmission("unknown", undefined, undefined).value).toMatchObject({
      submission_date_unknown: true,
      submitted_precision: "unknown",
    });
    expect(parseSubmission("day", "", undefined).error).toBeTruthy();
  });
  it("extracts LeetCode slugs only from leetcode hosts", () => {
    expect(leetcodeSlug("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
    expect(leetcodeSlug("https://evil.example/problems/two-sum/")).toBeNull();
    expect(leetcodeSlug(undefined)).toBeNull();
  });
  it("splits and bounds comma lists", () => {
    expect(splitList(" a, b ,, c\nd ")).toEqual(["a", "b", "c", "d"]);
    expect(splitList(Array(100).fill("x").join(","), 5)).toHaveLength(5);
  });
});
