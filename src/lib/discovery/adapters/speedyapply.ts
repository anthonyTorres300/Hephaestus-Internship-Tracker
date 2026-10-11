import { createPipeAdapter } from "./pipe";

// speedyapply/2027-SWE-College-Jobs and 2027-AI-College-Jobs: README.md holds the USA internship list as pipe tables per
// category (### FAANG+ / Quant / Other) with columns Company | Position | Location | [Salary] | Posting | Age.
// Locations carry a hidden-count suffix ("Seattle, WA +2"); only the first location is listed upstream, so the suffix is dropped.
// New-grad and international lists live in other files and are never fetched.
export const speedyapplyAdapter = createPipeAdapter({
  id: "speedyapply",
  version: "1",
  sections: true,
  skipUnrecognized: true,
  locationLines: (lines) => lines.map((l) => l.replace(/\s*\+\d+\s*$/, "")),
});
