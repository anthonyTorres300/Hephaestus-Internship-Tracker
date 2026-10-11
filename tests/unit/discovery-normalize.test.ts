import { describe, expect, it } from "vitest";
import { categorize, deriveGeo, detectSeason, extractRequirements, markersIn, normalizeLocationList } from "@/lib/discovery/normalize";
import { parseListingDate } from "@/lib/discovery/row";
import { parseCellHtml, parseHtmlTables, decodeEntities } from "@/lib/discovery/html";

const req = (title: string, markerText = "") => extractRequirements({ title, markers: markersIn(markerText) });

describe("season detection", () => {
  it("reads explicit season/year and refuses to guess", () => {
    expect(detectSeason("Software Engineer Intern - Summer 2027")).toEqual({ season: "summer", year: 2027 });
    expect(detectSeason("2027 Fall Co-op")).toEqual({ season: "fall", year: 2027 });
    expect(detectSeason("Intern")).toEqual({ season: null, year: null });
    expect(detectSeason("Summer 2027 or Fall 2027")).toEqual({ season: null, year: null });
    expect(detectSeason("Co-op - Summer/Fall 2027")).toEqual({ season: null, year: 2027 });
  });
});

describe("requirements extraction", () => {
  it("maps legend markers", () => {
    expect(req("Intern", "\u{1F6C2}").sponsorship_offered).toBe(false);
    expect(req("Intern", "\u{1F1FA}\u{1F1F8}").requires_citizenship).toEqual(["US"]);
    expect(req("Intern", "\u{1F393}").graduate_only).toBe(true);
  });
  it("extracts only explicit statements", () => {
    expect(req("Research Intern (US Citizenship required)").requires_citizenship).toEqual(["US"]);
    expect(req("Engineer Intern - TS/SCI clearance").requires_clearance).toBe(true);
    expect(req("Intern - No sponsorship available").sponsorship_offered).toBe(false);
    expect(req("ML Intern - MS/PhD")).toMatchObject({ graduate_only: true, degree_levels: ["masters", "phd"] });
    expect(req("Master's or Bachelor's Intern").graduate_only).toBeUndefined();
    expect(req("Software Engineer Intern")).toEqual({});
  });
  it("derives remote restriction from locations only when stated", () => {
    expect(deriveGeo(["Remote in USA", "Remote in Canada"])).toMatchObject({
      workMode: "remote",
      country: null,
      remoteRestrictedTo: ["CA", "US"],
    });
    expect(deriveGeo(["Remote", "US"])).toMatchObject({ workMode: "remote", remoteRestrictedTo: ["US"] });
    expect(deriveGeo(["Remote"])).toMatchObject({ workMode: "remote", remoteRestrictedTo: undefined });
    expect(deriveGeo(["Austin, TX"])).toMatchObject({ workMode: "unknown", country: "US" });
    expect(deriveGeo(["Remote", "Carmel, IN"]).workMode).toBe("unknown");
  });
});

describe("misc normalization", () => {
  it("categorizes and normalizes locations", () => {
    expect(categorize("Machine Learning Intern", "Software Engineering")).toBe("ai_ml");
    expect(categorize("Intern", "Product Management")).toBe("non_technical");
    expect(normalizeLocationList(["4 locations", "NYC", "SF", "NYC"])).toEqual(["New York, NY", "San Francisco, CA"]);
  });
  it("converts only stated dates; relative ages and year-less dates stay unknown", () => {
    expect(parseListingDate("2026-08-21")).toMatchObject({ precision: "day", year: 2026, month: 8, day: 21 });
    expect(parseListingDate("Aug 21, 2026")).toMatchObject({ precision: "day", month: 8 });
    expect(parseListingDate("Aug 21").precision).toBe("unknown");
    expect(parseListingDate("3d").precision).toBe("unknown");
  });
});

describe("categorize: software engineering titles", () => {
  it.each([
    ["Software Engineer Intern - ML Systems", "software"],
    ["AI Software Engineering Intern", "software"],
    ["Backend Software Engineer Intern - Java & AI", "backend"],
    ["Software Engineer Intern - Cloud & Distributed Backend", "backend"],
    ["Operations Software Engineering Intern (Summer 2027)", "software"],
    ["Software Engineer Intern - Air Taxi", "software"],
    ["Mobile Engineer Intern", "software"],
    ["Software Engineer Intern, Data Arch - E-commerce", "software"],
    ["Co-Op - Software Product Management", "non_technical"],
    ["Machine Learning Engineer Intern", "ai_ml"],
    ["Data Engineering Intern", "data"],
    ["Electrical Engineer Intern", "embedded"],
    ["Civil Engineering Intern - Infrastructure", "other_technical"],
    ["Mechanical Engineering Intern", "other_technical"],
    ["Engineering Intern", "other_technical"],
    ["Quantitative Research Intern", "other_technical"],
    ["Operations Analyst Intern", "non_technical"],
  ])("%s -> %s", (title, cat) => {
    expect(categorize(title, null)).toBe(cat);
  });
  it("uses the section only when the title is generic", () => {
    expect(categorize("Intern", "Software Engineering")).toBe("software");
    expect(categorize("Engineering Intern", "Software Engineering")).toBe("software");
  });
  it("reads trailing work-mode suffixes and lowercase country codes", () => {
    expect(deriveGeo(["San Francisco, CA (Hybrid)"])).toMatchObject({ country: "US", workMode: "hybrid" });
    expect(deriveGeo(["Ottawa, ON, ca"]).country).toBe("CA");
    expect(deriveGeo(["Vaughan, Ontario, CA"]).country).toBe("CA");
  });
});

describe("html extraction", () => {
  it("treats markup as data: strips scripts/handlers, decodes entities, keeps links", () => {
    const c = parseCellHtml(
      '<script>alert(1)</script><a href="https://x.test/a?b=1&amp;c=2" onclick="evil()"><img src=x alt="Apply"></a> A &amp; B<br>C</br>D',
    );
    expect(c.links).toEqual([{ href: "https://x.test/a?b=1&c=2", text: "", alt: "Apply" }]);
    expect(c.lines).toEqual(["A & B", "C", "D"]);
    expect(c.text).not.toContain("alert");
    expect(decodeEntities("&#x41;&lt;&bogus;")).toBe("A<&bogus;");
  });
  it("parses tables, including unclosed ones", () => {
    const t = parseHtmlTables("<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2");
    expect(t[0].closed).toBe(false);
    expect(t[0].rows.map((r) => r.cells[0].text)).toEqual(["1", "2"]);
    expect(t[0].rows[1].truncated).toBe(true);
  });
});
