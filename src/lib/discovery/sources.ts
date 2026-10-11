export interface SourceConfig {
  owner: string;
  repo: string;
  path: string;
  adapterId: string;
  adapterVersion: string;
  enabled: boolean;
  license: string;
  attribution: string;
}

// Default branches are resolved through the GitHub API at run time (SimplifyJobs and vanshb03 use `dev`; the others use `main`).
export const SOURCES: readonly SourceConfig[] = [
  {
    owner: "SimplifyJobs",
    repo: "Summer2027-Internships",
    path: "README.md",
    adapterId: "simplify",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from SimplifyJobs/Summer2027-Internships (Pitt CSC & Simplify). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.",
  },
  {
    owner: "vanshb03",
    repo: "Summer2027-Internships",
    path: "README.md",
    adapterId: "vansh",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from vanshb03/Summer2027-Internships (Vansh & CSCareers), MIT License, Copyright (c) 2025 Vansh Bataviya.",
  },
  {
    owner: "speedyapply",
    repo: "2027-SWE-College-Jobs",
    path: "README.md",
    adapterId: "speedyapply",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from speedyapply/2027-SWE-College-Jobs (SpeedyApply). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.",
  },
  {
    owner: "speedyapply",
    repo: "2027-AI-College-Jobs",
    path: "README.md",
    adapterId: "speedyapply",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from speedyapply/2027-AI-College-Jobs (SpeedyApply). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.",
  },
  {
    owner: "ApplyGuy",
    repo: "2027-Internships",
    path: "README.md",
    adapterId: "applyguy",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from ApplyGuy/2027-Internships (Apply Guy), MIT License, Copyright (c) 2026 Apply Guy.",
  },
  {
    owner: "sndsh404",
    repo: "summer-2027-internships",
    path: "README.md",
    adapterId: "slashpipe",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from sndsh404/summer-2027-internships, MIT License, Copyright (c) 2026 Sandesh Bhandari.",
  },
  {
    owner: "negarprh",
    repo: "Canadian-Tech-Internships-2027",
    path: "README.md",
    adapterId: "slashpipe",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from negarprh/Canadian-Tech-Internships-2027. The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row.",
  },
  {
    owner: "aprameyak",
    repo: "2027-tech-jobs",
    path: "SUMMER.md",
    adapterId: "aprameyak",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from aprameyak/2027-tech-jobs (SUMMER.md), MIT License, Copyright (c) 2026 Aprameya Kannan.",
  },
  {
    owner: "aprameyak",
    repo: "2027-tech-jobs",
    path: "OFFCYCLE.md",
    adapterId: "aprameyak",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from aprameyak/2027-tech-jobs (OFFCYCLE.md), MIT License, Copyright (c) 2026 Aprameya Kannan.",
  },
  {
    owner: "jobbie-bot",
    repo: "Summer-2027-Tech-Internships",
    path: "README.md",
    adapterId: "jobbie",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from jobbie-bot/Summer-2027-Tech-Internships (Jobbie), MIT License, Copyright (c) 2026 Jobbie.",
  },
  {
    owner: "resumax",
    repo: "tech-internships",
    path: "README.md",
    adapterId: "resumax",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution: "Listings from resumax/tech-internships (ResuMax), MIT License, Copyright (c) 2026 ResuMax.",
  },
  {
    owner: "zshah101",
    repo: "Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships",
    path: "README.md",
    adapterId: "zshah",
    adapterVersion: "1",
    enabled: true,
    license: "MIT",
    attribution:
      "Listings from zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships, MIT License, Copyright (c) 2026 Shah Zain.",
  },
  {
    owner: "jobright-ai",
    repo: "2026-Software-Engineer-Internship",
    path: "README.md",
    adapterId: "jobright",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from jobright-ai/2026-Software-Engineer-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.",
  },
  {
    owner: "jobright-ai",
    repo: "2026-Data-Analysis-Internship",
    path: "README.md",
    adapterId: "jobright",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from jobright-ai/2026-Data-Analysis-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.",
  },
  {
    owner: "jobright-ai",
    repo: "2026-Engineer-Internship",
    path: "README.md",
    adapterId: "jobright",
    adapterVersion: "1",
    enabled: true,
    license: "none-declared",
    attribution:
      "Listings from jobright-ai/2026-Engineer-Internship (Jobright.ai). The repository declares no license; only factual listing fields (company, role, location, apply link) are stored, with a link back to the source row. Apply links are Jobright redirect links, not employer pages.",
  },
];

export const ALLOWED_HOSTS = ["api.github.com", "raw.githubusercontent.com"] as const;

export const FETCH_LIMITS = {
  timeoutMs: 20_000,
  maxBytes: 10 * 1024 * 1024,
  maxRetries: 3,
  maxRedirects: 3,
  maxWaitMs: 60_000,
} as const;

export const MAX_QUARANTINE_RATIO = 0.1;

export function findSource(owner: string, repo: string, path: string, adapterId: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.enabled && s.owner === owner && s.repo === repo && s.path === path && s.adapterId === adapterId);
}
