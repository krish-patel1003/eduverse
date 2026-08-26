import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import {
  getStandard,
  gradesAvailable,
  hasPublishedLadder,
  searchStandards,
  standardLadder,
  standardsByDomain,
  standardsStats,
} from "@/lib/standards";

export const runtime = "nodejs";

// Browse or search the curriculum spine. A grade returns the standards grouped
// the way a curriculum is actually read: domain, then cluster, then skill.
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") ?? "math";
  const q = url.searchParams.get("q");

  if (q) return NextResponse.json({ results: searchStandards(q, subject) });

  // Prerequisites for one standard, walked from the published sequence. Useful
  // in its own right: a parent asking "what does my child need before this?"
  // gets real codes they can check, not a generated guess.
  const ladderFor = url.searchParams.get("ladder");
  if (ladderFor) {
    const std = getStandard(ladderFor);
    if (!std) return NextResponse.json({ error: "Unknown standard code" }, { status: 404 });
    return NextResponse.json({
      standard: std,
      published: hasPublishedLadder(std.code),
      prerequisites: standardLadder(std.code),
    });
  }

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
