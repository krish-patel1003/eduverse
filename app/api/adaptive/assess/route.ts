import { NextRequest, NextResponse } from "next/server";
import { generateAssessment, gradeAssessment } from "@/lib/assessment";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { recordEvent, upsertConcept } from "@/lib/profile";
import { recordTeachingOutcome } from "@/lib/effectiveness";
import {
  getWeakArea,
  getAdaptiveSession,
  getRoundAssessment,
  getSessionAssessment,
  saveSessionAssessment,
  scheduleReview,
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
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const session = getAdaptiveSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Retry: replay the exact assessment from a past round instead of a new one.
    const retryRound = url.searchParams.get("round");
    if (retryRound) {
      const past = getRoundAssessment(sessionId, Number(retryRound));
      if (!past) return NextResponse.json({ error: "That attempt is no longer available." }, { status: 404 });
      return NextResponse.json({ items: past.items.map(publicItem), domain: past.domain, retryOf: Number(retryRound) });
    }

    const roundNum = Math.max(1, session.rounds.length);
    const last = session.rounds[session.rounds.length - 1];
    // Assess the skill we actually TAUGHT this round, which may be a
    // prerequisite below the original aspect.
    const skill = last?.taughtSkill || session.aspect;
    const priorMistakes = session.rounds.flatMap((r) => r.misconceptions ?? []);
    const assessment = await generateAssessment({
      topic: session.topic,
      level: getWeakArea(session.weakAreaId)?.level,
      mode: "thorough",
      aspects: [skill],
      priorMistakes: [...new Set(priorMistakes)],
    });
    saveSessionAssessment(sessionId, assessment, roundNum);
    updateAdaptiveSession(sessionId, { status: "assessing" });

    return NextResponse.json({ items: assessment.items.map(publicItem), domain: assessment.domain, skill });
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

    // A retry grades against THAT round's stored questions, not the latest set.
    const retryOf = Number(body?.retryOf);
    const session = getAdaptiveSession(sessionId);
    const assessment = Number.isFinite(retryOf) && retryOf > 0
      ? getRoundAssessment(sessionId, retryOf)
      : getSessionAssessment(sessionId);
    if (!session || !assessment) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const result = await gradeAssessment({ assessment, answers });

    // Record the outcome on the latest round.
    const rounds = [...session.rounds];
    const last =
      Number.isFinite(retryOf) && retryOf > 0
        ? rounds.find((r) => r.round === retryOf) ?? rounds[rounds.length - 1]
        : rounds[rounds.length - 1];
    if (last) {
      last.overall = result.overall;
      last.passed = result.passed;
      last.weakAspects = result.weakAspects;
      // Keep the full record: this is what the NEXT round diagnoses from.
      last.evidence = result.evidence ?? [];
      last.misconceptions = [
        ...new Set((result.evidence ?? []).map((e) => e.misconception).filter((m): m is string => !!m)),
      ];
    }

    // Mastery: passing the thorough check counts as mastered; otherwise record progress.
    const mastery = result.passed ? Math.max(0.85, result.overall / 100) : result.overall / 100;
    setWeakAreaMastery(session.weakAreaId, mastery);
    // Schedule the next review so mastery does not silently decay.
    scheduleReview(session.weakAreaId, result.passed);
    upsertConcept(`${session.topic}: ${session.aspect}`, result.passed ? 0.3 : result.overall / 100 - 0.4, studentId);

    // Teaching Effectiveness Profile: record how THIS approach performed on THIS
    // skill for THIS child. The best approach changes by concept, so it is keyed
    // by skill rather than stored as one global "learning style".
    if (last?.mode && last?.method) {
      recordTeachingOutcome(studentId, session.topic, {
        skill: last.taughtSkill || session.aspect,
        mode: last.mode,
        method: last.method,
        beforeScore: last.beforeScore,
        afterScore: result.overall,
        successful: result.passed,
      });
    }

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
