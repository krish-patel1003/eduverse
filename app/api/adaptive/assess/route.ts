import { NextRequest, NextResponse } from "next/server";
import { generateAssessment, gradeAssessment } from "@/lib/assessment";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { recordEvent, upsertConcept } from "@/lib/profile";
import {
  getAdaptiveSession,
  getSessionAssessment,
  saveSessionAssessment,
  setWeakAreaMastery,
  updateAdaptiveSession,
} from "@/lib/adaptive";
import type { AssessmentItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_ROUNDS = 4;

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
  };
}

// GET: generate + store the thorough post-video assessment for the taught aspect.
export async function GET(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
    const session = getAdaptiveSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const priorMistakes = session.rounds.flatMap((r) => r.weakAspects ?? []);
    const assessment = await generateAssessment({
      topic: session.topic,
      level: undefined,
      mode: "thorough",
      aspects: [session.aspect],
      priorMistakes: [...new Set(priorMistakes)],
    });
    saveSessionAssessment(sessionId, assessment);
    updateAdaptiveSession(sessionId, { status: "assessing" });

    return NextResponse.json({ items: assessment.items.map(publicItem), domain: assessment.domain });
  } catch (err) {
    console.error("adaptive assess GET error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Assessment failed" }, { status: 500 });
  }
}

// POST: grade the submission and decide mastered vs re-teach.
export async function POST(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const studentId = currentStudentId(req);
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "");
    const answers = (body?.answers ?? {}) as Record<string, unknown>;

    const session = getAdaptiveSession(sessionId);
    const assessment = getSessionAssessment(sessionId);
    if (!session || !assessment) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const result = await gradeAssessment({ assessment, answers });

    // Record the outcome on the latest round.
    const rounds = [...session.rounds];
    const last = rounds[rounds.length - 1];
    if (last) {
      last.overall = result.overall;
      last.passed = result.passed;
      last.weakAspects = result.weakAspects;
    }

    // Mastery: passing the thorough check counts as mastered; otherwise record progress.
    const mastery = result.passed ? Math.max(0.85, result.overall / 100) : result.overall / 100;
    setWeakAreaMastery(session.weakAreaId, mastery);
    upsertConcept(`${session.topic}: ${session.aspect}`, result.passed ? 0.3 : result.overall / 100 - 0.4, studentId);

    const roundsUsed = rounds.length;
    const capped = !result.passed && roundsUsed >= MAX_ROUNDS;
    updateAdaptiveSession(sessionId, {
      status: result.passed ? "mastered" : capped ? "paused" : "teaching",
      rounds,
    });
    recordEvent({
      type: "adaptive_assessed",
      isCorrect: result.passed,
      data: { topic: session.topic, aspect: session.aspect, overall: result.overall, round: roundsUsed },
      studentId,
    });

    return NextResponse.json({
      passed: result.passed,
      mastered: result.passed,
      capped,
      roundsUsed,
      maxRounds: MAX_ROUNDS,
      overall: result.overall,
      perAspect: result.perAspect,
      perItem: result.perItem,
      weakAspects: result.weakAspects,
      summary: result.summary,
    });
  } catch (err) {
    console.error("adaptive assess POST error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Grading failed" }, { status: 500 });
  }
}
