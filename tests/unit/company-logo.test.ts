import { describe, expect, it } from "vitest";
import { logoDomainCandidates, normalizeCompanyName } from "@/lib/jobs/company-logo";

describe("company logo domains", () => {
  it("normalizes company names", () => {
    expect(normalizeCompanyName("Google LLC")).toBe("google");
    expect(normalizeCompanyName("Amazon Web Services (AWS)")).toBe("amazon web services");
    expect(normalizeCompanyName("The Boeing Company")).toBe("boeing");
    expect(normalizeCompanyName("AT&T")).toBe("at and t");
  });

  it("uses the employer's own domain when the apply link is on it", () => {
    expect(logoDomainCandidates("Google", "https://careers.google.com/jobs/results/123")[0]).toBe("google.com");
    expect(logoDomainCandidates("Acme", "https://jobs.acme.co.uk/role/1")[0]).toBe("acme.co.uk");
  });

  it("ignores job boards and aggregators and falls back to a name guess", () => {
    expect(logoDomainCandidates("Stripe", "https://boards.greenhouse.io/stripe/jobs/1")).toEqual(["stripe.com"]);
    expect(logoDomainCandidates("Jane Street", "https://jobs.lever.co/janestreet/x")).toEqual(["janestreet.com"]);
    expect(logoDomainCandidates("Contoso", "https://x.myworkdayjobs.com/en-US/c/job/1")).toEqual(["contoso.com"]);
    expect(logoDomainCandidates("Contoso", "https://applyguy.ai/r/abc")).toEqual(["contoso.com"]);
  });

  it("never uses an aggregator's own site as the company logo (e.g. Jobright redirects)", () => {
    expect(logoDomainCandidates("Acme Robotics", "https://jobright.ai/jobs/info/abc123")).toEqual(["acmerobotics.com"]);
    expect(logoDomainCandidates("Acme", "https://applyguy.ai/r/1")).toEqual(["acme.com"]);
    expect(logoDomainCandidates("Acme", "https://www.ripplematch.com/x")).toEqual(["acme.com"]);
  });

  it("applies known overrides and never builds a domain from junk", () => {
    expect(logoDomainCandidates("Amazon Web Services (AWS)", null)[0]).toBe("aws.amazon.com");
    expect(logoDomainCandidates("", null)).toEqual([]);
    expect(logoDomainCandidates("A", null)).toEqual([]);
    expect(logoDomainCandidates("!!!", "not a url")).toEqual([]);
  });
});
