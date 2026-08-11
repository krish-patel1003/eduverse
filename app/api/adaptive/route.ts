import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { listDiagnostics, listWeakAreas } from "@/lib/adaptive";

export const runtime = "nodejs";

// The Adaptive Tutor dashboard/report payload: who they are, their diagnostics,
// and their ranked weak areas.
export async function GET(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const studentId = currentStudentId(req);
    const profile = getProfile(studentId);
    return NextResponse.json({
      profile: {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        educationLevel: profile.educationLevel,
      },
      diagnostics: listDiagnostics(studentId),
      weakAreas: listWeakAreas(studentId),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
