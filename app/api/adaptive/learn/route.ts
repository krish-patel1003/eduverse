import { NextRequest, NextResponse } from "next/server";
import { generateExplainer } from "@/lib/gemini";
import { hintToPrompt, learnerHint, recordEvent } from "@/lib/profile";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { buildPrereqLadder, diagnoseNextSkill } from "@/lib/diagnose";
import {
  US_PEDAGOGY,
  isTeachingMode,
  routeTeaching,
  routeToPrompt,
  type ConcreteMode,
  type TeachingMethod,
  type TeachingMode,
} from "@/lib/pedagogy";
import { bestForSkill } from "@/lib/effectiveness";
import { feedbackTeachingHint, feedbackWantsModeChange } from "@/lib/feedback";
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
    // What the CHILD asked for. "auto" (the prominent default) hands the choice
    // to the engine, which is what we want most learners pressing.
    const requested: TeachingMode = isTeachingMode(body?.mode) ? body.mode : "auto";

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
        method: last?.method,
        routeReason: last?.routeReason ?? "",
        roundsUsed: session.rounds.length,
        maxRounds: MAX_ROUNDS,
        ...meta,
      });
    }

    if (session.rounds.length >= MAX_ROUNDS) {
      updateAdaptiveSession(session.id, { status: "paused" });
      return NextResponse.json(
        {
          error: "You've had several rounds on this. Take a break and come back to it.",
          capped: true,
          roundsUsed: session.rounds.length,
          maxRounds: MAX_ROUNDS,
        },
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
    const lastFeedback = lastRound?.feedback;
    // If the learner said the last lesson was confusing / too fast / unhelpful,
    // do not reuse what "usually" works: force a genuinely different approach.
    const forceChange = !!lastFeedback && feedbackWantsModeChange(lastFeedback.reactions);

    // Signals the router reasons over. These come from the diagnosis of the last
    // attempt, not from a fixed profile.
    const sameMisconceptionTwice = (() => {
      const seen = new Map<string, number>();
      for (const r of session.rounds)
        for (const m of r.misconceptions ?? []) seen.set(m, (seen.get(m) ?? 0) + 1);
      return [...seen.values()].some((n) => n > 1);
    })();
    // Right answers but weak justification: auto-graded items landed while the
    // open, explain-your-reasoning items did not.
    const canDoCannotExplain = (() => {
      const ev = evidence;
      if (!ev.length) return false;
      const open = ev.filter((e) => ["short_answer", "essay", "math_multistep", "pseudocode"].includes(e.type));
      const auto = ev.filter((e) => ["mcq", "multi_mcq", "fill_blank"].includes(e.type));
      if (open.length < 2 || auto.length < 2) return false;
      const pct = (xs: typeof ev) => xs.filter((e) => e.correct).length / xs.length;
      return pct(auto) >= 0.75 && pct(open) < 0.5;
    })();
    const needsFluency = (lastRound?.overall ?? 0) >= 60 && (lastRound?.overall ?? 0) < 70;

    const route = routeTeaching({
      requested,
      round: roundNum,
      mastery: weak.mastery,
      droppedDown: diagnosis.droppedDown,
      repeatedMistake: sameMisconceptionTwice || forceChange,
      isReview: weak.status === "mastered",
      canDoCannotExplain,
      needsFluency,
      alreadyTried: session.rounds
        .filter((r) => r.mode && r.method)
        .map((r) => ({ mode: r.mode as ConcreteMode, method: r.method as TeachingMethod })),
      bestForSkill: forceChange ? null : bestForSkill(studentId, diagnosis.teachSkill),
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
      (lastFeedback ? `${feedbackTeachingHint(lastFeedback.reactions, lastFeedback.text)}\n` : "") +
      `${routeToPrompt(route)}\n` +
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
        mode: route.mode,
        method: route.method,
        routeReason: route.rationale,
        beforeScore: lastRound?.overall,
        at: Date.now(),
      },
    ];
    updateAdaptiveSession(session.id, { status: "teaching", rounds });
    recordEvent({
      type: "adaptive_taught",
      data: {
        topic: weak.topic,
        aspect: weak.aspect,
        skill: diagnosis.teachSkill,
        droppedDown: diagnosis.droppedDown,
        mode: route.mode,
        method: route.method,
        auto: route.auto,
        round: roundNum,
      },
      studentId,
    });

    return NextResponse.json({
      sessionId: session.id,
      explainer,
      round: roundNum,
      teachSkill: diagnosis.teachSkill,
      droppedDown: diagnosis.droppedDown,
      reason: diagnosis.reason,
      mode: route.mode,
      method: route.method,
      routeReason: route.rationale,
      auto: route.auto,
      roundsUsed: rounds.length,
      maxRounds: MAX_ROUNDS,
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
