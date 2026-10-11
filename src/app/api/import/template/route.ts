import { NextResponse } from "next/server";
import { ORIGINAL_HEADERS } from "@/lib/import";
import { toCsv } from "@/lib/export";

// Synthetic example rows only.
export function GET() {
  const body = toCsv(
    [...ORIGINAL_HEADERS],
    [
      [
        "Northwind Aerospace",
        "Software Engineering Intern, Summer 2027",
        "Sept. 2024",
        "Pending",
        "",
        "",
        "https://careers.example.com/status",
      ],
      ["Contoso Labs", "Backend Intern", "Aug.26.25", "SCREENING PROCESS", "Oct 8.25", "", "Email recruiter"],
    ],
    { bom: true },
  );
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="hephaestus-import-template.csv"' },
  });
}
