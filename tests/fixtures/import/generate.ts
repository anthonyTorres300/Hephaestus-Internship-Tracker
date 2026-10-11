// Synthetic fixtures only (fake companies). Run via the tests; do not add real log data.
export const TEMPLATE_CSV =
  "Company Name,Position Applied For,Application Date,Status,Interview Date,Offer Received,To Check Progress\r\n" +
  "Northwind Aerospace,Software Engineering Intern Summer 2027,Aug.26.25,Pending,,,Email\r\n" +
  "Contoso Labs,Software Engineer I,Sept. 2024,SCREENING PROCESS,Oct 8.25,,https://careers.example.com/portal/abc\r\n" +
  'Fabrikam Systems,Co-op Developer,"September 5, 2025",Offer Received,,Yes,Portal\r\n';

export const MESSY_CSV =
  "﻿Company Name,Position Applied For,Application Date,Status,Interview Date,Offer Received,To Check Progress\n" +
  '"Northwind Aerospace, Inc.","Software Engineer, Platform",Aug. 6. 26,Ghosted,,,"Check portal\nweekly"\n' +
  ",,,,,,\n" +
  "Contoso Labs,Backend Intern,03/04/25,Not Proceeding,,,\n" +
  "Contoso Labs,Backend Intern,03/04/25,Not Proceeding,,,\n" +
  ",,,,,,\n" +
  "\n";

export const TSV = (csvLike: string[][]) => csvLike.map((r) => r.join("\t")).join("\n") + "\n";

export function bigCsv(rows: number): string {
  const lines = ["Company Name,Position Applied For,Application Date,Status,Interview Date,Offer Received,To Check Progress"];
  for (let i = 0; i < rows; i++) lines.push(`Synthetic Co ${i},Role ${i},2025-08-26,Pending,,,`);
  return lines.join("\n");
}
