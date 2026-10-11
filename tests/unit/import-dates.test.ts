import { describe, expect, it } from "vitest";
import { parseImportDate, TWO_DIGIT_YEAR_RULE } from "@/lib/import";

const now = new Date("2026-10-10T00:00:00Z");
const p = (s: string) => parseImportDate(s, now);

describe("parseImportDate", () => {
  it.each([
    ["Aug.26.25", 2025, 8, 26],
    ["Aug. 6. 26", 2026, 8, 6],
    ["Oct 8.25", 2025, 10, 8],
    ["Mar.24.26", 2026, 3, 24],
    ["September 5, 2025", 2025, 9, 5],
    ["2025-08-26", 2025, 8, 26],
  ])("%s => day precision", (raw, y, m, d) => {
    const r = p(raw);
    expect(r).toMatchObject({ status: "ok", precision: "day", year: y, month: m, day: d, raw });
  });
  it("Sept. 2024 is month precision with no day", () => {
    const r = p("Sept. 2024");
    expect(r).toMatchObject({ status: "ok", precision: "month", year: 2024, month: 9 });
    expect(r.day).toBeUndefined();
    expect(p("2024-09")).toMatchObject({ precision: "month", month: 9 });
  });
  it("documents the two-digit year rule", () => {
    expect(p("Aug.26.25").message).toBe(TWO_DIGIT_YEAR_RULE);
    expect(p("Aug.26.25").rule).toContain("two_digit_year");
  });
  it("blank and invalid", () => {
    expect(p("  ")).toMatchObject({ status: "blank", precision: "unknown" });
    expect(p("soon")).toMatchObject({ status: "invalid" });
    expect(p("Feb.30.25").status).toBe("invalid");
    expect(p("2025-02-29").status).toBe("invalid");
  });
  it("ambiguous numeric dates need review and carry candidates", () => {
    const r = p("03/04/25");
    expect(r.status).toBe("ambiguous");
    expect(r.precision).toBe("unknown");
    expect(r.candidates).toHaveLength(2);
    expect(p("13/04/25").status).toBe("ok");
    expect(p("04/13/25")).toMatchObject({ status: "ok", month: 4, day: 13 });
    expect(p("05/05/25").status).toBe("ok");
    expect(p("Sept 24").status).toBe("ambiguous");
  });
  it("flags suspicious, never fixes", () => {
    const far = p("Jan.21.29");
    expect(far).toMatchObject({ status: "suspicious", year: 2029, month: 1, day: 21 });
    expect(p("Jan.21.14")).toMatchObject({ status: "suspicious", year: 2014 });
    expect(p("Jan.21.27").status).toBe("ok");
    expect(p("Jan.21.25").status).toBe("ok");
    expect(p("Oct 10 2027").status).toBe("ok");
    expect(p("Oct 11 2027").status).toBe("suspicious");
  });
});
