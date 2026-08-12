import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule, completeModuleUnlockNext } from "@/lib/store";
import { recordEvent, upsertConcept } from "@/lib/profile";

export const runtime = "nodejs";

// Mark a module complete, unlock the next, and give a small mastery bump to the
// module's objective concepts.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    const course = getCourse(id);
    if (!course || !mod || mod.courseId !== id) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Certification mode gates completion behind the required quiz + assignment.
    if (course.mode === "certification" && (!mod.quizPassed || !mod.assignmentPassed)) {
      const missing = [
        !mod.quizPassed ? "pass the module quiz" : null,
        !mod.assignmentPassed ? "pass the assignment" : null,
      ].filter(Boolean);
      return NextResponse.json(
        { error: `Finish the requirements first: ${missing.join(" and ")}.` },
        { status: 403 }
      );
    }

    const updated = completeModuleUnlockNext(mid);
    // Finishing a module is weak positive evidence for its concepts.
    for (const obj of mod.objectives) upsertConcept(obj, 0.1, course.studentId);
    upsertConcept(mod.title, 0.1, course.studentId);
    recordEvent({ type: "module_completed", moduleId: mid, isCorrect: true, data: { title: mod.title }, studentId: course.studentId });

    return NextResponse.json({ course: updated });
  } catch (err) {
    console.error("module complete error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Complete failed" },
      { status: 500 }
    );
  }
}
