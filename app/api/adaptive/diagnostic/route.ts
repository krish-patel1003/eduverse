import { NextRequest, NextResponse } from "next/server";
import { generateAssessment } from "@/lib/assessment";
import { createDiagnostic, savePlacement } from "@/lib/adaptive";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getEducationLevel } from "@/lib/profile";
import { PROBE_SIZE, MAX_STAGES, bandLabel, progress, startPlacement } from "@/lib/placement";
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
    visual: it.visual,
    // No hints on a diagnostic: it measures what the learner can do unaided, so
    // offering help there would distort the placement.
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

    // Adaptive placement: instead of one long test pitched at the grade the
    // learner typed in, ask a SHORT probe and then move up or down a band based
    // on how it went, converging on where they are actually working. The stated
    // grade is only a starting guess.
    const placement = startPlacement(topic, level);
    const assessment = await generateAssessment({
      topic,
      level: bandLabel(placement.currentBand),
      mode: "probe",
      probeSize: PROBE_SIZE,
    });
    const diagnosticId = createDiagnostic(assessment, studentId);
    savePlacement(diagnosticId, placement);

    return NextResponse.json({
      diagnosticId,
      stage: 1,
      maxStages: MAX_STAGES,
      band: bandLabel(placement.currentBand),
      progress: progress(placement),
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
