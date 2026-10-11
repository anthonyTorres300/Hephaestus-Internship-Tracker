import { createPipeAdapter } from "./pipe";

// ApplyGuy/2027-Internships: README.md holds one pipe table per section (Software Engineering, Product Management) with
// Company | Role | Location | Season | Posted | Actions. The Actions cell has an applyguy.ai redirect plus the original employer link;
// only the employer link is stored as the apply URL.
export const applyguyAdapter = createPipeAdapter({
  id: "applyguy",
  version: "1",
  sections: true,
  skipUnrecognized: true,
  seasonColumn: true,
});
