import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getEducationLevel } from "@/lib/profile";
import { parseBand } from "@/lib/gradeband";
import { listStandards, standardsByDomain } from "@/lib/standards";
import { cachedSubSkillsForGrade, ensureGradeExpanded, subSkillStats } from "@/lib/subskills";

export const runtime = "nodejs";
export const maxDuration = 300;

// The skills that matter FOR THIS LEARNER, taken from their profile grade.
//
// This is the "show me what I should be learning" path: rather than asking a
// child to name a topic (which assumes they know what they do not know), the
// grade on their profile becomes the reference point for the whole list.
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const studentId = currentStudentId(req);
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") ?? "math";

  // Explicit grade wins; otherwise fall back to the learner's profile.
  const profileLevel = getEducationLevel(studentId);
  const grade = url.searchParams.get("grade") ?? parseBand(profileLevel) ?? "4";

  const subs = cachedSubSkillsForGrade(grade, subject);
  const domains = standardsByDomain(grade, subject).map((d) => ({
    domain: d.domain,
    clusters: d.clusters.map((c) => ({
      cluster: c.cluster,
      standards: c.standards.map((s) => ({
        ...s,
        subSkills: (subs.get(s.code) ?? []).map((x) => x.name),
      })),
    })),
  }));

  const total = listStandards(grade, subject).length;
  return NextResponse.json({
    grade,
    subject,
    fromProfile: !url.searchParams.get("grade"),
    profileLevel,
    domains,
    expanded: subs.size,
    totalStandards: total,
    complete: subs.size >= total && total > 0,
    stats: subSkillStats(subject),
  });
}

// Expand a grade into sub-skills. Generated once, then read forever, which is
// what makes the list identical on every later visit.
export async function POST(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const subject = typeof body?.subject === "string" ? body.subject : "math";
  const grade = String(body?.grade ?? "").trim();
  if (!grade) return NextResponse.json({ error: "Which grade?" }, { status: 400 });

  const result = await ensureGradeExpanded(grade, subject);
  return NextResponse.json({ grade, ...result, stats: subSkillStats(subject) });
}
