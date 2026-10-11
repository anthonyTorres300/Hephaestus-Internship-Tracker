import { createPipeAdapter } from "./pipe";

// vanshb03/Summer2027-Internships: README.md holds one GitHub-flavoured pipe table
// (Company | Role | Location | Application/Link | Date Posted); cells may contain inline HTML.
// Single flat list: the nearest heading is the legend, not a category, so no section is recorded.
export const vanshAdapter = createPipeAdapter({ id: "vansh", version: "1", tableMarkers: true });
