import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule, setModuleQuizPassed } from "@/lib/store";
import { applyQuizResult, recordEvent } from "@/lib/profile";

export const runtime = "nodejs";

const PASS_PCT = 0.7;

// Grade a submitted required-quiz attempt (certification mode). Sets the module's
// quiz_passed flag when the learner scores >= 70%.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) return NextResponse.json({ error: "Module not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items)
      ? body.items
          .filter((it: unknown) => it && typeof it === "object")
          .map((it: { concept?: unknown; isCorrect?: unknown }) => ({
            concept: typeof it.concept === "string" ? it.concept : undefined,
            isCorrect: it.isCorrect === true,
          }))
      : [];
    if (items.length === 0) return NextResponse.json({ error: "No answers submitted." }, { status: 400 });

    const studentId = getCourse(id)?.studentId;
    const correct = items.filter((i: { isCorrect: boolean }) => i.isCorrect).length;
    const pct = correct / items.length;
    const passed = pct >= PASS_PCT;

    applyQuizResult(items, mid, studentId);
    if (passed) setModuleQuizPassed(mid, true);
    recordEvent({
      type: "req_quiz",
      moduleId: mid,
      isCorrect: passed,
      data: { total: items.length, correct, pct: Math.round(pct * 100), passed },
      studentId,
    });

    return NextResponse.json({ passed, score: Math.round(pct * 100), correct, total: items.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
