import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { listPaths, startPath } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ paths: listPaths(currentStudentId(req)) });
}

// Start a whole domain as a guided path. No diagnostic: the curriculum already
// says what the skills are and what order they belong in.
export async function POST(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const grade = String(body?.grade ?? "").trim();
  const domain = String(body?.domain ?? "").trim();
  if (!grade || !domain) return NextResponse.json({ error: "Need a grade and a topic." }, { status: 400 });

  const path = startPath({ studentId: currentStudentId(req), grade, domain, subject: body?.subject });
  if (!path) return NextResponse.json({ error: "No skills found for that topic." }, { status: 404 });
  return NextResponse.json({ path });
}
