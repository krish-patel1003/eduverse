import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getLearningStyle, recordEvent, updateLearningStyle } from "@/lib/profile";
import { feedbackStylePatch, normalizeReactions } from "@/lib/feedback";
import { attachRoundFeedback } from "@/lib/adaptive";

export const runtime = "nodejs";

// End-of-lesson feedback. Records the reactions + optional note, nudges the
// learner model so future lessons are generated closer to what works, and (when
// the lesson was part of an adaptive session) annotates that round so the next
// re-teach can react to how this one felt.
export async function POST(req: NextRequest) {
  try {
    if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const studentId = currentStudentId(req);
    const body = await req.json().catch(() => ({}));

    const reactions = normalizeReactions(body?.reactions);
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
    if (!reactions.length && !text) {
      return NextResponse.json({ error: "Pick a reaction or leave a note." }, { status: 400 });
    }

    const explainerId = typeof body?.explainerId === "string" ? body.explainerId : undefined;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : undefined;
    const round = Number.isFinite(body?.round) ? Number(body.round) : undefined;
    const context = typeof body?.context === "string" ? body.context.slice(0, 40) : "lesson";

    // 1. Log the raw signal.
    recordEvent({
      type: "lesson_feedback",
      data: { reactions, text, explainerId, sessionId, round, context },
      studentId,
    });

    // 2. Shape the durable learner model.
    const patch = feedbackStylePatch(reactions, getLearningStyle(studentId));
    const applied = Object.keys(patch).length > 0;
    if (applied) updateLearningStyle(patch, studentId);

    // 3. Feed the adaptive loop, if this lesson came from one.
    if (sessionId && round) {
      attachRoundFeedback(sessionId, round, { reactions, text: text || undefined, at: Date.now() });
    }

    return NextResponse.json({ ok: true, adjusted: applied });
  } catch (err) {
    console.error("feedback error", err);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
