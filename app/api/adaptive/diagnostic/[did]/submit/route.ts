import { NextRequest, NextResponse } from "next/server";
import { generateAssessment, rankFor, gradeAssessment } from "@/lib/assessment";
import {
  getDiagnosticAssessment,
  getPlacement,
  replaceDiagnosticAssessment,
  saveDiagnosticResult,
  savePlacement,
  upsertWeakArea,
} from "@/lib/adaptive";
import { currentUserId } from "@/lib/auth";
import { recordEvent, upsertConcept } from "@/lib/profile";
import {
  MAX_STAGES,
  PROBE_SIZE,
  askedAspects,
  bandLabel,
  decideNext,
  progress,
  type PlacementState,
} from "@/lib/placement";
import type { AssessmentItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function publicItem(it: AssessmentItem) {
  return {
    id: it.id,
    type: it.type,
    aspect: it.aspect,
    prompt: it.prompt,
    options: it.options,
    language: it.language,
    starterCode: it.starterCode,
    blanks: it.type === "fill_blank" ? (it.correct?.length ?? 1) : undefined,
    visual: it.visual,
    // Still no hints during placement: it measures unaided ability.
  };
}

// Grade one placement probe.
//
// If placement has not converged, this returns the NEXT probe at a different
// band rather than a final report. When it has converged, the weak areas are
// seeded at the WORKING band, which is the important part: previously they were
// stamped with the grade the learner typed in, so an initial misjudgement
// propagated into every ladder, lesson and assessment afterwards.
export async function POST(req: NextRequest, ctx: { params: Promise<{ did: string }> }) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const { did } = await ctx.params;
    const stored = getDiagnosticAssessment(did);
    if (!stored) return NextResponse.json({ error: "Diagnostic not found" }, { status: 404 });
    const { studentId, assessment } = stored;

    const body = await req.json().catch(() => ({}));
    const answers = (body?.answers ?? {}) as Record<string, unknown>;

    const seconds = (body?.seconds && typeof body.seconds === "object" ? body.seconds : {}) as Record<string, number>;
    const result = await gradeAssessment({ assessment, answers, seconds });

    const placement = getPlacement<PlacementState>(did);
    // No placement state means a legacy one-shot diagnostic; finish it as before.
    if (placement && !placement.done) {
      placement.stages.push({
        stage: placement.stages.length + 1,
        band: placement.currentBand,
        score: result.overall,
        aspects: assessment.items.map((i) => i.aspect),
      });

      const decision = decideNext(placement, result.overall);

      if (!decision.done && decision.nextBand) {
        // Probe again at the new band.
        placement.currentBand = decision.nextBand;
        const next = await generateAssessment({
          topic: assessment.topic,
          level: bandLabel(decision.nextBand),
          mode: "probe",
          probeSize: PROBE_SIZE,
          avoidAspects: askedAspects(placement),
        });
        replaceDiagnosticAssessment(did, next);
        savePlacement(did, placement);
        return NextResponse.json({
          placing: true,
          stage: placement.stages.length + 1,
          maxStages: MAX_STAGES,
          band: bandLabel(decision.nextBand),
          reason: decision.reason,
          progress: progress(placement),
          items: next.items.map(publicItem),
          domain: next.domain,
        });
      }

      // Converged. Record the working band and finish.
      placement.workingBand = decision.workingBand;
      placement.done = true;
      savePlacement(did, placement, decision.workingBand);
    }

    const workingLevel = placement?.workingBand ? bandLabel(placement.workingBand) : assessment.level;
    const rank = rankFor(result.overall);
    saveDiagnosticResult(did, result, rank);

    // Seed weak areas at the level the learner is ACTUALLY working at.
    for (const a of result.perAspect) {
      upsertWeakArea({
        studentId,
        topic: assessment.topic,
        aspect: a.aspect,
        domain: assessment.domain,
        level: workingLevel,
        mastery: a.score / 100,
      });
      upsertConcept(`${assessment.topic}: ${a.aspect}`, a.score / 100 - 0.4, studentId);
    }

    recordEvent({
      type: "diagnostic",
      isCorrect: result.passed,
      data: {
        topic: assessment.topic,
        overall: result.overall,
        rank,
        statedBand: placement?.statedBand,
        workingBand: placement?.workingBand,
        stages: placement?.stages.length,
      },
      studentId,
    });

    return NextResponse.json({
      placing: false,
      overall: result.overall,
      rank,
      perAspect: result.perAspect,
      weakAspects: result.weakAspects,
      perItem: result.perItem,
      summary: result.summary,
      // Placement outcome, so the learner can be told where they are starting.
      workingLevel,
      statedLevel: placement ? bandLabel(placement.statedBand) : assessment.level,
      movedLevel: !!placement && placement.workingBand !== placement.statedBand,
      questionsAsked: placement ? placement.stages.length * PROBE_SIZE : assessment.items.length,
    });
  } catch (err) {
    console.error("diagnostic submit error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Grading failed" }, { status: 500 });
  }
}
