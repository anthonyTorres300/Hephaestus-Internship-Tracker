import { describe, expect, it } from "vitest";
import { DEFAULT_JOB_PREFS, ROLE_GROUPS, isGraduateOnly, parseJobPrefs } from "@/lib/jobs/prefs";

describe("undergrad-friendly filter", () => {
  it.each([
    "PhD Software Engineering Intern",
    "Software Engineer Intern (Ph.D.)",
    "Research Intern - Master's Student",
    "Graduate Student Researcher Intern",
    "ML Intern, MS/PhD",
    "Doctoral Research Intern",
  ])("treats %s as graduate-only", (title) => expect(isGraduateOnly({ title })).toBe(true));

  it.each([
    "Software Engineer Intern",
    "Backend Engineering Intern, Summer 2027",
    "Software Engineering Intern (Undergraduate)",
    "Data Intern",
  ])("keeps %s", (title) => expect(isGraduateOnly({ title })).toBe(false));

  it("uses explicit requirements when the title is silent", () => {
    expect(isGraduateOnly({ title: "Software Intern", requirements: { graduate_only: true } })).toBe(true);
    expect(isGraduateOnly({ title: "Software Intern", requirements: { degree_levels: ["masters", "phd"] } })).toBe(true);
    expect(isGraduateOnly({ title: "Software Intern", requirements: { degree_levels: ["bachelors", "masters"] } })).toBe(false);
    expect(isGraduateOnly({ title: "Software Intern", requirements: {} })).toBe(false);
  });
});

describe("saved job preferences", () => {
  it("defaults to SWE roles and undergrad-friendly", () => {
    expect(DEFAULT_JOB_PREFS).toEqual({ role: "swe", undergradOnly: true });
    expect(parseJobPrefs(undefined)).toEqual(DEFAULT_JOB_PREFS);
  });
  it("ignores malformed or tampered cookie values", () => {
    expect(parseJobPrefs("not json")).toEqual(DEFAULT_JOB_PREFS);
    expect(parseJobPrefs('{"role":"admin","undergradOnly":"yes"}')).toEqual(DEFAULT_JOB_PREFS);
    expect(parseJobPrefs('{"role":"data_ai","undergradOnly":false}')).toEqual({ role: "data_ai", undergradOnly: false });
  });
  it("SWE group covers the software categories only", () => {
    expect(ROLE_GROUPS.swe.categories).toEqual(["software", "backend", "frontend", "fullstack"]);
    expect(ROLE_GROUPS.all.categories).toHaveLength(0);
  });
});
