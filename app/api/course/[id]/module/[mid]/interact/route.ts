import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule } from "@/lib/store";
import { generateQuiz, generateAssignment, answerDoubt } from "@/lib/course";
import { reExplainRange } from "@/lib/gemini";
import {
  learnerHint,
  hintToPrompt,
  recordEvent,
  applyQuizResult,
  updateLearningStyle,
} from "@/lib/profile";
import type { Explainer, LearningStyle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Concatenated narration of the module's explainer = the material the assistant
// reasons over for quizzes, assignments, and doubts.
function moduleContext(explainer?: Explainer): string {
  if (!explainer) return "";
  return explainer.scenes
    .map((s) => s.narration)
    .filter(Boolean)
    .join(" ")
    .slice(0, 8000);
}

// Turn a free-text "explain it with X" request into concrete style signals, so
// later modules adapt, not just this re-explanation.
function inferStyle(request: string): Partial<LearningStyle> {
  const r = request.toLowerCase();
  const patch: Partial<LearningStyle> = { notes: request.trim() ? [request.trim()] : [] };
  if (/\banalog|metaphor|like a\b|real ?world|everyday/.test(r)) patch.analogies = 3;
  if (/\bexample|worked|step by step|walk ?through/.test(r)) patch.examples = 3;
  if (/\bslow|slower|simpl|beginner|eli5|five|child|kid\b/.test(r)) patch.pace = "slow";
  if (/\bfast|quick|concise|brief|summary\b/.test(r)) patch.pace = "fast";
  if (/\bfun|playful|casual|jokes?\b/.test(r)) patch.tone = "playful";
  if (/\bformal|rigor|precise|technical\b/.test(r)) patch.tone = "formal";
  return patch;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const studentId = getCourse(id)?.studentId;
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "");
    const request = String(body?.request ?? "").trim();
    const context = moduleContext(mod.explainer);
    const hint = learnerHint(studentId);

    switch (type) {
      case "quiz": {
        const quizzes = await generateQuiz({ context, hint });
        recordEvent({ type: "quiz_generated", moduleId: mid, data: { count: quizzes.length }, studentId });
        return NextResponse.json({ quizzes });
      }

      case "quiz-result": {
        // Client reports graded outcomes; update mastery + practice history.
        const items = Array.isArray(body?.items)
          ? body.items
              .filter((it: unknown) => it && typeof it === "object")
              .map((it: { concept?: unknown; isCorrect?: unknown }) => ({
                concept: typeof it.concept === "string" ? it.concept : undefined,
                isCorrect: it.isCorrect === true,
              }))
          : [];
        applyQuizResult(items, mid, studentId);
        // Persist a full attempt summary so results can be revisited later.
        const correct = items.filter((i: { isCorrect: boolean }) => i.isCorrect).length;
        recordEvent({
          type: "quiz_result",
          moduleId: mid,
          isCorrect: items.length > 0 && correct === items.length,
          data: { total: items.length, correct, items },
          studentId,
        });
        return NextResponse.json({ ok: true });
      }

      case "assignment": {
        const tasks = await generateAssignment({ context, hint });
        recordEvent({ type: "assignment", moduleId: mid, data: { tasks }, studentId });
        return NextResponse.json({ tasks });
      }

      case "doubt": {
        if (!request) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
        const answer = await answerDoubt({ question: request, context, hint });
        recordEvent({ type: "doubt", moduleId: mid, data: { question: request }, studentId });
        return NextResponse.json({ answer });
      }

      case "explain": {
        // Re-explain a fresh way. Structural style prefs (pace/analogy density)
        // persist and adapt future modules; the concrete subject request does
        // NOT stick (so we never pin everything to one analogy domain).
        const patch = inferStyle(request);
        const style = updateLearningStyle(patch, studentId);
        // `focus` = a specific clip's narration to re-explain (from "Re-explain
        // this clip"); otherwise re-explain the whole module.
        const focus = typeof body?.focus === "string" && body.focus.trim() ? body.focus.trim() : "";
        const explainer = await reExplainRange({
          originalTitle: mod.title,
          style: "linear",
          focusNarration: focus || context || mod.title,
          userNote: request || undefined,
          learnerBlock: hintToPrompt({ style, weakConcepts: hint.weakConcepts, motivation: hint.motivation }),
        });
        recordEvent({ type: "explain_again", moduleId: mid, data: { request, clip: Boolean(focus) }, studentId });
        return NextResponse.json({ explainer, style });
      }

      default:
        return NextResponse.json({ error: "Unknown interaction type" }, { status: 400 });
    }
  } catch (err) {
    console.error("interact error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interaction failed" },
      { status: 500 }
    );
  }
}
