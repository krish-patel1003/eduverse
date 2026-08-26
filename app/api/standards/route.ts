import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { gradesAvailable, searchStandards, standardsByDomain, standardsStats } from "@/lib/standards";

export const runtime = "nodejs";

// Browse or search the curriculum spine. A grade returns the standards grouped
// the way a curriculum is actually read: domain, then cluster, then skill.
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") ?? "math";
  const q = url.searchParams.get("q");

  if (q) return NextResponse.json({ results: searchStandards(q, subject) });

  const grade = url.searchParams.get("grade") ?? "4";
  return NextResponse.json({
    grade,
    subject,
    grades: gradesAvailable(subject),
    domains: standardsByDomain(grade, subject),
    stats: standardsStats(),
    attribution:
      "Skills follow the Common Core State Standards for Mathematics. © 2010 National Governors Association Center for Best Practices and Council of Chief State School Officers.",
  });
}
