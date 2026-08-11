import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule, saveAssignmentSubmission } from "@/lib/store";
import { gradeAssignment } from "@/lib/course";
import { learnerHint, recordEvent } from "@/lib/profile";

export const runtime = "nodejs";
export const maxDuration = 120;

// AI-grade a required-assignment submission (certification mode) and store the
// answers + pass flag. Returns per-task feedback.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) return NextResponse.json({ error: "Module not found" }, { status: 404 });
    const tasks = mod.requiredAssignment ?? [];
    if (tasks.length === 0) return NextResponse.json({ error: "This module has no assignment." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const answers: string[] = tasks.map((_, i) =>
      Array.isArray(body?.answers) && typeof body.answers[i] === "string" ? String(body.answers[i]) : ""
    );
    if (answers.every((a) => !a.trim())) {
      return NextResponse.json({ error: "Write your answers before submitting." }, { status: 400 });
    }

    const studentId = getCourse(id)?.studentId;
    const context = (mod.explainer?.scenes ?? []).map((s) => s.narration).filter(Boolean).join(" ").slice(0, 6000);
    const grade = await gradeAssignment({ tasks, answers, context, hint: learnerHint(studentId) });

    saveAssignmentSubmission(mid, answers, grade.passed);
    recordEvent({ type: "req_assignment", moduleId: mid, isCorrect: grade.passed, data: { score: grade.score }, studentId });

    return NextResponse.json({ grade });
  } catch (err) {
    console.error("submit-assignment error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Grading failed" }, { status: 500 });
  }
}
