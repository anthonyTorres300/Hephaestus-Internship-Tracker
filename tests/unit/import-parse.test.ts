import { describe, expect, it } from "vitest";
import { ImportLimitError, mapColumns, ORIGINAL_HEADERS, parseTable } from "@/lib/import";
import { bigCsv, MESSY_CSV, TEMPLATE_CSV, TSV } from "../fixtures/import/generate";

describe("parseTable", () => {
  it("strips BOM and handles quoted commas and embedded newlines", () => {
    const t = parseTable(MESSY_CSV);
    expect(t.headers[0]).toBe("Company Name");
    expect(t.rows[0][0]).toBe("Northwind Aerospace, Inc.");
    expect(t.rows[0][1]).toBe("Software Engineer, Platform");
    expect(t.rows[0][6]).toBe("Check portal\nweekly");
  });
  it("trims trailing empty rows but keeps interior blanks", () => {
    const t = parseTable(MESSY_CSV);
    expect(t.rows).toHaveLength(4);
    expect(t.rows[1].every((c) => c === "")).toBe(true);
    expect(t.rowCount).toBe(4);
  });
  it("detects TSV (pasted)", () => {
    const t = parseTable(TSV([[...ORIGINAL_HEADERS], ["Contoso Labs", "Intern, Data", "Oct 8.25", "Pending", "", "", ""]]));
    expect(t.delimiter).toBe("\t");
    expect(t.rows[0][1]).toBe("Intern, Data");
  });
  it("detects CSV and honours explicit delimiter", () => {
    expect(parseTable(TEMPLATE_CSV).delimiter).toBe(",");
    expect(parseTable("a;b\n1;2", { delimiter: "," }).headers).toEqual(["a;b"]);
  });
  it("pads short rows and reports extra cells", () => {
    const t = parseTable("a,b\n1\n1,2,3\n");
    expect(t.rows[0]).toEqual(["1", ""]);
    expect(t.errors.some((e) => e.code === "extra_cells")).toBe(true);
  });
  it("enforces limits", () => {
    expect(parseTable(bigCsv(5000)).rowCount).toBe(5000);
    expect(() => parseTable(bigCsv(5001))).toThrowError(ImportLimitError);
    try {
      parseTable(bigCsv(5001));
    } catch (e) {
      expect((e as ImportLimitError).code).toBe("too_many_rows");
    }
    try {
      parseTable("a\n" + "x".repeat(5 * 1024 * 1024 + 1));
    } catch (e) {
      expect((e as ImportLimitError).code).toBe("too_large");
    }
  });
});

describe("mapColumns", () => {
  it("matches case/whitespace-insensitively and supports overrides", () => {
    const m = mapColumns([
      " company  name",
      "POSITION APPLIED FOR",
      "Application Date",
      "status",
      "x",
      "offer_received",
      "To Check Progress",
    ]);
    expect(m.company_name).toBe(0);
    expect(m.role_title).toBe(1);
    expect(m.offer_received).toBe(5);
    expect(m.interview_date).toBeNull();
    expect(mapColumns(["a", "b"], { company_name: 1 }).company_name).toBe(1);
  });
});
