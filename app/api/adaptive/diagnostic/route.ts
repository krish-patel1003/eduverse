import { NextRequest, NextResponse } from "next/server";
import { generateAssessment } from "@/lib/assessment";
import { createDiagnostic } from "@/lib/adaptive";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getEducationLevel } from "@/lib/profile";
import type { AssessmentItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Strip answer keys before sending an assessment to the client.
function publicItem(it: AssessmentItem) {
  return {
    id: it.id,
    type: it.type,
    aspect: it.aspect,
    prompt: it.prompt,
    options: it.options,
    language: it.language,
    starterCode: it.starterCode,
    // number of blanks (so the UI can render the right inputs) without the answers
    blanks: it.type === "fill_blank" ? (it.correct?.length ?? 1) : undefined,
  };
}

// Build a level-calibrated, aspect-exhaustive diagnostic for a topic the learner
// says they struggle with.
export async function POST(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const studentId = currentStudentId(req);
    const body = await req.json().catch(() => ({}));
    const topic = String(body?.topic ?? "").trim();
    if (!topic) return NextResponse.json({ error: "Name a topic you struggle with." }, { status: 400 });

    const level = getEducationLevel(studentId);
    const assessment = await generateAssessment({ topic, level, mode: "diagnostic" });
    const diagnosticId = createDiagnostic(assessment, studentId);

    return NextResponse.json({
      diagnosticId,
      topic: assessment.topic,
      domain: assessment.domain,
      level,
      items: assessment.items.map(publicItem),
    });
  } catch (err) {
    console.error("diagnostic error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Diagnostic failed" }, { status: 500 });
  }
}
