import { NextRequest, NextResponse } from "next/server";
import { getCourse, issueCertificate, getCertificateForCourse } from "@/lib/store";
import { generateExam } from "@/lib/course";
import { learnerHint, getStudentName, recordEvent } from "@/lib/profile";

export const runtime = "nodejs";
export const maxDuration = 120;

const PASS_PCT = 70;

// Certification exam. Requires every module completed.
function allModulesDone(courseModules: { status: string }[]) {
  return courseModules.length > 0 && courseModules.every((m) => m.status === "completed");
}

// GET: build the exam questions (not persisted; generated fresh per attempt).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const course = getCourse(id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (course.mode !== "certification")
      return NextResponse.json({ error: "This course has no exam." }, { status: 400 });
    if (!allModulesDone(course.modules))
      return NextResponse.json({ error: "Complete every module before the exam." }, { status: 403 });

    const moduleNarrations = course.modules.map((m) =>
      (m.explainer?.scenes ?? []).map((s) => s.narration).filter(Boolean).join(" ")
    );
    const quizzes = await generateExam({ courseTitle: course.title, moduleNarrations, hint: learnerHint() });
    return NextResponse.json({ quizzes, certificate: getCertificateForCourse(id) });
  } catch (err) {
    console.error("exam GET error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Exam failed" }, { status: 500 });
  }
}

// POST: grade a submitted exam; on >=70% issue the certificate.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const course = getCourse(id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (course.mode !== "certification")
      return NextResponse.json({ error: "This course has no exam." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    const total = items.length;
    const correct = items.filter((it: { isCorrect?: unknown }) => it?.isCorrect === true).length;
    const score = total ? Math.round((correct / total) * 100) : 0;
    const passed = score >= PASS_PCT;

    recordEvent({ type: "exam", data: { courseId: id, score, passed }, isCorrect: passed });

    let certificate = null;
    if (passed) {
      const learnerName = (typeof body?.name === "string" && body.name.trim()) || getStudentName() || "Learner";
      certificate = issueCertificate({
        courseId: id,
        courseTitle: course.title,
        learnerName: learnerName.slice(0, 80),
        score,
      });
    }
    return NextResponse.json({ passed, score, correct, total, certificate });
  } catch (err) {
    console.error("exam POST error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Exam grading failed" }, { status: 500 });
  }
}
