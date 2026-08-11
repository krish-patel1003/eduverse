import { NextRequest, NextResponse } from "next/server";
import { generateExplainer } from "@/lib/gemini";
import { hintToPrompt, learnerHint, recordEvent } from "@/lib/profile";
import { currentUserId, currentStudentId } from "@/lib/auth";
import {
  getWeakArea,
  activeSessionForWeakArea,
  createAdaptiveSession,
  getAdaptiveSession,
  getSessionExplainer,
  saveSessionExplainer,
  updateAdaptiveSession,
  type AdaptiveRound,
} from "@/lib/adaptive";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ROUNDS = 4;

// Start (or continue) the recursive teaching loop for a weak area. The SYSTEM
// decides what to teach, composing the prompt from the aspect + level + the
// learner's prior mistakes. No user prompt is involved.
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
    // Reuse the existing teaching video unless we're re-teaching after a miss.
    const existing = getSessionExplainer(session.id);
    if (existing && !force) {
      return NextResponse.json({ sessionId: session.id, explainer: existing, round: session.rounds.length, ...meta });
    }

    if (session.rounds.length >= MAX_ROUNDS) {
      updateAdaptiveSession(session.id, { status: "paused" });
      return NextResponse.json(
        { error: "You've had several rounds on this. Take a break and come back to it.", capped: true },
        { status: 429 }
      );
    }

    // Mistakes gathered from prior rounds sharpen the re-teach.
    const priorMistakes = session.rounds.flatMap((r) => r.weakAspects ?? []);
    const roundNum = session.rounds.length + 1;
    const prompt =
      `Teach the concept "${weak.aspect}" within "${weak.topic}" to a ${weak.level || "general"} learner who is struggling with it. ` +
      `Build understanding from the ground up with clear, concrete worked examples. ` +
      (priorMistakes.length
        ? `They still get these wrong, so address them head on with a different angle than before: ${[...new Set(priorMistakes)].join(", ")}. `
        : "") +
      `Make sure they can actually apply it, not just recall it.`;

    const explainer = await generateExplainer({
      prompt,
      style: "interactive",
      learnerBlock: hintToPrompt(learnerHint(studentId)),
    });
    saveSessionExplainer(session.id, explainer);

    const rounds: AdaptiveRound[] = [
      ...session.rounds,
      { round: roundNum, explainerId: explainer.id, taughtAspects: [weak.aspect], at: Date.now() },
    ];
    updateAdaptiveSession(session.id, { status: "teaching", rounds });
    recordEvent({ type: "adaptive_taught", data: { topic: weak.topic, aspect: weak.aspect, round: roundNum }, studentId });

    return NextResponse.json({ sessionId: session.id, explainer, round: roundNum, ...meta });
  } catch (err) {
    console.error("adaptive learn error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start" }, { status: 500 });
  }
}

// Fetch the current session state (for resuming the loop page).
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  const session = getAdaptiveSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session, explainer: getSessionExplainer(sessionId) });
}
