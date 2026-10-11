import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  candidateKey,
  deriveIdentity,
  isCandidatePortalUrl,
  normalizeCompany,
  normalizeTitle,
  NORMALIZATION_VERSION,
  recognizeAts,
} from "@/lib/discovery/identity";

describe("canonicalizeUrl", () => {
  it("strips known tracking params and fragments, lowercases host, normalizes slashes", () => {
    expect(canonicalizeUrl("HTTPS://Jobs.Example.com/careers/123/?utm_source=Simplify&ref=Simplify&gclid=x#apply")).toBe(
      "https://jobs.example.com/careers/123",
    );
  });
  it("keeps job-identifying params, sorted", () => {
    expect(canonicalizeUrl("https://x.com/apply?jobId=9&gh_jid=7&utm_medium=a")).toBe("https://x.com/apply?gh_jid=7&jobId=9");
    expect(canonicalizeUrl("https://x.com/a?req=R1&ref=somethingelse")).toBe("https://x.com/a?ref=somethingelse&req=R1");
  });
  it("rejects non-http schemes", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("not a url")).toBeNull();
  });
});

describe("ATS recognition and identity", () => {
  it("extracts namespace, tenant and requisition id", () => {
    expect(recognizeAts("https://job-boards.greenhouse.io/acme/jobs/42?gh_src=x")).toEqual({
      ats: "greenhouse",
      tenant: "acme",
      requisitionId: "42",
    });
    expect(recognizeAts("https://jobs.lever.co/acme/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/apply")?.tenant).toBe("acme");
    expect(recognizeAts("https://jobs.ashbyhq.com/replit/7e0dafe8-3eec-442e-aa76-a4d84d779fb1")?.ats).toBe("ashby");
    expect(recognizeAts("https://flir.wd1.myworkdayjobs.com/en-US/site/job/US-AL/Intern_REQ36193")).toEqual({
      ats: "workday",
      tenant: "flir",
      requisitionId: "REQ36193",
    });
    expect(recognizeAts("https://jobs.smartrecruiters.com/Acme/743999-intern")).toEqual({
      ats: "smartrecruiters",
      tenant: "acme",
      requisitionId: "743999",
    });
    expect(recognizeAts("https://careers-acme.icims.com/jobs/1234/intern/job")).toEqual({
      ats: "icims",
      tenant: "acme",
      requisitionId: "1234",
    });
    expect(recognizeAts("https://example.com/jobs/1")).toBeNull();
  });
  it("tenants differ => identity differs; same job via different tracking/locale => same identity", () => {
    const a = deriveIdentity("https://boards.greenhouse.io/acme/jobs/42");
    const b = deriveIdentity("https://boards.greenhouse.io/other/jobs/42");
    const c = deriveIdentity("https://job-boards.greenhouse.io/acme/jobs/42?utm_source=Simplify&ref=Simplify");
    expect(a.identityKey).toBe("ats:greenhouse:acme:42");
    expect(b.identityKey).not.toBe(a.identityKey);
    expect(c.identityKey).toBe(a.identityKey);
    expect(deriveIdentity("https://x.wd5.myworkdayjobs.com/en-US/s/job/L/T_R1").identityKey).toBe(
      deriveIdentity("https://x.wd5.myworkdayjobs.com/fr-CA/s/job/L/T_R1?utm_source=a").identityKey,
    );
  });
  it("falls back to canonical url identity", () => {
    expect(deriveIdentity("https://jobs.ea.com/en_US/careers/JobDetail/x/216225?utm_source=Simplify&ref=Simplify")).toMatchObject({
      identityKey: "url:https://jobs.ea.com/en_US/careers/JobDetail/x/216225",
      atsNamespace: null,
    });
  });
  it("never turns candidate dashboards or shared portals into identity", () => {
    expect(isCandidatePortalUrl("https://acme.wd1.myworkdayjobs.com/en-US/site/userHome")).toBe(true);
    expect(deriveIdentity("https://acme.wd1.myworkdayjobs.com/en-US/site/userHome").identityKey).toBeNull();
    expect(deriveIdentity("https://careers.acme.com/").identityKey).toBeNull();
    expect(deriveIdentity("https://careers.acme.com/students").identityKey).toBeNull();
    expect(deriveIdentity("https://careers.acme.com/jobs?jid=5").identityKey).toBe("url:https://careers.acme.com/jobs?jid=5");
    expect(deriveIdentity(null).identityKey).toBeNull();
  });
});

describe("candidate key", () => {
  it("is stable under case/suffix/location order and differs by season year", () => {
    const k = candidateKey({
      company: "Acme, Inc.",
      title: "Software Engineering Internship (Summer 2027)",
      locations: ["NYC", "Austin, TX"],
      seasonYear: 2027,
    });
    expect(k).toBe(
      candidateKey({ company: "ACME", title: "Software Engineer Intern", locations: ["austin, tx", "nyc"], seasonYear: 2027 }),
    );
    expect(k).not.toBe(
      candidateKey({ company: "ACME", title: "Software Engineer Intern", locations: ["austin, tx", "nyc"], seasonYear: 2026 }),
    );
    expect(normalizeCompany("Ernst & Young LLP")).toBe("ernst and young");
    expect(normalizeTitle("SWE Intern - Summer 2027")).toBe("swe intern");
  });
  it("exposes a normalization version", () => {
    expect(NORMALIZATION_VERSION).toBeTruthy();
  });
});
