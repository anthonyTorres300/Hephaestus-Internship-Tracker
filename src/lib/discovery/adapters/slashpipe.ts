import { createPipeAdapter } from "./pipe";

// Pipe-table lists that put several locations in one cell separated by " / " (sndsh404/summer-2027-internships,
// negarprh/Canadian-Tech-Internships-2027). Company | Role | Location | Apply | Added/Date Posted. Side tables
// (programs, fellowships) have different headers and are skipped.
export const slashpipeAdapter = createPipeAdapter({
  id: "slashpipe",
  version: "1",
  skipUnrecognized: true,
  locationLines: (lines) =>
    lines
      .flatMap((l) => l.split(/\s+\/\s+/))
      .map((l) => l.replace(/\s*\((?:multiple|various)[^)]*\)\s*$/i, "").trim())
      .filter(Boolean),
});
