import { NextRequest, NextResponse } from "next/server";
import { generateExplainer } from "@/lib/gemini";
import { getLearningStyle, hintToPrompt, learnerHint, recordEvent } from "@/lib/profile";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { buildPrereqLadder, diagnoseNextSkill } from "@/lib/diagnose";
import { US_PEDAGOGY, modeToPrompt, pickTeachingMode, type TeachingMode } from "@/lib/pedagogy";
import {
  getWeakArea,
  activeSessionForWeakArea,
  createAdaptiveSession,
  getAdaptiveSession,
  getRoundExplainer,
  getSessionExplainer,
  saveSessionExplainer,
  updateAdaptiveSession,
  type AdaptiveRound,
} from "@/lib/adaptive";
import type { Diagnosis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

const MAX_ROUNDS = 4;

// Start (or continue) the recursive teaching loop for a weak area.
//
// The system decides what to teach with no user prompt. Crucially, on a retry it
// does NOT simply re-teach the same aspect in a different style: it reads the
// learner's actual wrong answers, builds a prerequisite ladder, and drops to the
// lowest broken rung. A learner who cannot add single digits gets taught single
// digit addition, not multi digit addition with a new analogy.
export async function POST(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const studentId = currentStudentId(req);
    const body = await req.json().catch(() => ({}));
    const weakAreaId = String(body?.weakAreaId ?? "");
    const force = body?.reteach === true; // generate a fresh take even if one exists

    const weak = getWeakArea(weakAreaId);
    if (!weak) return NextResponse.json({ error: "Weak area not found" }, { status: 404 });

    let session = activeSessionForWeakArea(weakAreaId);
    if (!session) {
      session = createAdaptiveSession({
        studentId,
        weakAreaId,
        topic: weak.topic,
        aspect: weak.aspect,
        domain: weak.domain,
      });
    }

    const meta = { topic: weak.topic, aspect: weak.aspect, domain: weak.domain };
    // Reuse the existing lesson unless we are re-teaching after a miss.
    const existing = getSessionExplainer(session.id);
    if (existing && !force) {
      const last = session.rounds[session.rounds.length - 1];
      return NextResponse.json({
        sessionId: session.id,
        explainer: existing,
        round: Math.max(1, session.rounds.length),
        teachSkill: last?.taughtSkill ?? weak.aspect,
        droppedDown: last?.droppedDown ?? false,
        reason: last?.reason ?? "",
        mode: last?.mode,
        ...meta,
      });
    }

    if (session.rounds.length >= MAX_ROUNDS) {
      updateAdaptiveSession(session.id, { status: "paused" });
      return NextResponse.json(
        { error: "You've had several rounds on this. Take a break and come back to it.", capped: true },
        { status: 429 }
      );
    }

    const roundNum = session.rounds.length + 1;

    // ---- decide WHAT to teach -------------------------------------------------
    // Round 1 teaches the aspect itself. Later rounds diagnose the root cause
    // from the previous attempt's evidence and may drop below it.
    let diagnosis: Diagnosis = {
      teachSkill: weak.aspect,
      droppedDown: false,
      misconceptions: [],
      reason: "",
      teachingNotes: "",
    };
    const lastRound = session.rounds[session.rounds.length - 1];
    const evidence = lastRound?.evidence ?? [];
    if (evidence.length) {
      const ladder = await buildPrereqLadder({
        skill: lastRound?.taughtSkill || weak.aspect,
        topic: weak.topic,
        level: weak.level,
      });
      diagnosis = await diagnoseNextSkill({
        skill: lastRound?.taughtSkill || weak.aspect,
        topic: weak.topic,
        level: weak.level,
        ladder,
        evidence,
        alreadyTaught: session.rounds.map((r) => r.taughtSkill).filter((x): x is string => !!x),
      });
    }

    // ---- decide HOW to teach it ---------------------------------------------
    // A retry must not just reword the same delivery. Change the teaching mode,
    // preferring whatever has actually produced mastery for this learner before.
    const style = getLearningStyle(studentId);
    const mode = pickTeachingMode({
      alreadyTried: session.rounds.map((r) => r.mode).filter((m): m is TeachingMode => !!m),
      preferred: style.bestMode as TeachingMode | undefined,
      round: roundNum,
    });

    // ---- build the lesson prompt from the diagnosis + real mistakes ----------
    const wrongExamples = evidence
      .filter((e) => !e.correct)
      .slice(0, 5)
      .map((e) => `  - Asked: ${e.question}\n    They answered: ${e.learnerAnswer || "(blank)"}${e.misconception ? `\n    Why it was wrong: ${e.misconception}` : ""}`)
      .join("\n");

    const prompt =
      `Teach the skill "${diagnosis.teachSkill}" to a ${weak.level || "general"} learner, as part of understanding "${weak.topic}".\n` +
      `${US_PEDAGOGY}\n` +
      (diagnosis.droppedDown
        ? `IMPORTANT: this learner tried "${lastRound?.taughtSkill || weak.aspect}" and it did not stick, because a FOUNDATION is missing. You are deliberately going back to teach that foundation. Assume NOTHING above this skill. Start from the very beginning of this skill, with concrete, physical examples before any procedure or notation. Do not teach the harder skill again.\n`
        : `Build the skill from the ground up with clear, concrete worked examples.\n`) +
      (diagnosis.teachingNotes ? `TEACHING NOTES: ${diagnosis.teachingNotes}\n` : "") +
      (diagnosis.misconceptions.length
        ? `The learner currently believes these wrong things, so confront each one directly and show why it is wrong: ${diagnosis.misconceptions.join("; ")}.\n`
        : "") +
      (wrongExamples ? `Here is exactly what they got wrong last time:\n${wrongExamples}\n` : "") +
      `${modeToPrompt(mode)}\n` +
      `Make sure they can actually apply the skill, not just recall it.`;

    const explainer = await generateExplainer({
      prompt,
      style: "interactive",
      learnerBlock: hintToPrompt(learnerHint(studentId)),
    });
    saveSessionExplainer(session.id, explainer, roundNum);

    const rounds: AdaptiveRound[] = [
      ...session.rounds,
      {
        round: roundNum,
        explainerId: explainer.id,
        taughtAspects: [diagnosis.teachSkill],
        taughtSkill: diagnosis.teachSkill,
        droppedDown: diagnosis.droppedDown,
        reason: diagnosis.reason,
        mode,
        at: Date.now(),
      },
    ];
    updateAdaptiveSession(session.id, { status: "teaching", rounds });
    recordEvent({
      type: "adaptive_taught",
      data: { topic: weak.topic, aspect: weak.aspect, skill: diagnosis.teachSkill, droppedDown: diagnosis.droppedDown, mode, round: roundNum },
      studentId,
    });

    return NextResponse.json({
      sessionId: session.id,
      explainer,
      round: roundNum,
      teachSkill: diagnosis.teachSkill,
      droppedDown: diagnosis.droppedDown,
      reason: diagnosis.reason,
      mode,
      ...meta,
    });
  } catch (err) {
    console.error("adaptive learn error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start" }, { status: 500 });
  }
}

// Session state (for resuming), plus optional replay of a specific past round.
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  const session = getAdaptiveSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const roundParam = url.searchParams.get("round");
  const explainer = roundParam
    ? getRoundExplainer(sessionId, Number(roundParam))
    : getSessionExplainer(sessionId);
  return NextResponse.json({ session, explainer });
}
