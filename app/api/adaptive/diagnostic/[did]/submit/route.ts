import { NextRequest, NextResponse } from "next/server";
import { gradeAssessment, rankFor } from "@/lib/assessment";
import { getDiagnosticAssessment, saveDiagnosticResult, upsertWeakArea } from "@/lib/adaptive";
import { currentUserId } from "@/lib/auth";
import { recordEvent, upsertConcept } from "@/lib/profile";

export const runtime = "nodejs";
export const maxDuration = 120;

// Grade a submitted diagnostic: per-aspect scores, an overall rank, and seed the
// learner's weak areas from the aspects they scored below the bar.
export async function POST(req: NextRequest, ctx: { params: Promise<{ did: string }> }) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const { did } = await ctx.params;
    const stored = getDiagnosticAssessment(did);
    if (!stored) return NextResponse.json({ error: "Diagnostic not found" }, { status: 404 });
    const { studentId, assessment } = stored;

    const body = await req.json().catch(() => ({}));
    const answers = (body?.answers ?? {}) as Record<string, unknown>;

    const result = await gradeAssessment({ assessment, answers });
    const rank = rankFor(result.overall);
    saveDiagnosticResult(did, result, rank);

    // Seed weak areas + concept mastery from the per-aspect scores.
    for (const a of result.perAspect) {
      upsertWeakArea({
        studentId,
        topic: assessment.topic,
        aspect: a.aspect,
        domain: assessment.domain,
        level: assessment.level,
        mastery: a.score / 100,
      });
      upsertConcept(`${assessment.topic}: ${a.aspect}`, a.score / 100 - 0.4, studentId);
    }
    recordEvent({
      type: "diagnostic",
      isCorrect: result.passed,
      data: { topic: assessment.topic, overall: result.overall, rank },
      studentId,
    });

    return NextResponse.json({
      overall: result.overall,
      rank,
      perAspect: result.perAspect,
      weakAspects: result.weakAspects,
      perItem: result.perItem,
      summary: result.summary,
    });
  } catch (err) {
    console.error("diagnostic submit error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Grading failed" }, { status: 500 });
  }
}
