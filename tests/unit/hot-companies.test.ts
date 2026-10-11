import { describe, expect, it } from "vitest";
import { HOT_COMPANY_NAMES, matchHot } from "@/lib/jobs/hot-companies";

describe("hot companies", () => {
  it("matches common name variants to the canonical company", () => {
    expect(matchHot("Google")).toBe("Google");
    expect(matchHot("Google LLC")).toBe("Google");
    expect(matchHot("Amazon Web Services (AWS)")).toBe("Amazon");
    expect(matchHot("Meta Platforms, Inc.")).toBe("Meta");
    expect(matchHot("NVIDIA Corporation")).toBe("Nvidia");
    expect(matchHot("The Boeing Company")).toBe("Boeing");
    expect(matchHot("Jane Street Capital")).toBe("Jane Street");
    expect(matchHot("JP Morgan Chase")).toBe("JPMorgan Chase");
    expect(matchHot("Collins Aerospace")).toBe("RTX");
    expect(matchHot("Duolingo")).toBe("Duolingo");
  });

  it("does not match companies that merely start with the same letters", () => {
    expect(matchHot("Metalenz")).toBeNull();
    expect(matchHot("Applebee's")).toBeNull();
    expect(matchHot("Googleplex Consulting Group")).toBeNull();
    expect(matchHot("Ramparts Labs")).toBeNull();
    expect(matchHot("")).toBeNull();
  });

  it("has unique names and includes the headline companies", () => {
    expect(new Set(HOT_COMPANY_NAMES).size).toBe(HOT_COMPANY_NAMES.length);
    for (const n of ["Google", "Amazon", "Meta", "Nvidia", "Duolingo"]) expect(HOT_COMPANY_NAMES).toContain(n);
  });
});
