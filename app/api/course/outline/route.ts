import { NextRequest, NextResponse } from "next/server";
import { generateOutline } from "@/lib/course";
import { createCourse } from "@/lib/store";
import { extractFiles } from "@/lib/extract";
import { learnerHint, updateStudentMeta } from "@/lib/profile";
import { researchTopic } from "@/lib/research";
import { currentStudentId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

// Topic + goals (+ optional docs) -> a draft course with a module outline the
// learner reviews and approves.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const topic = String(form.get("topic") ?? "").trim();
    const mode = String(form.get("mode") ?? "self_eval") === "certification" ? "certification" : "self_eval";
    const motivation = String(form.get("motivation") ?? "").trim() || undefined;
    const goals = String(form.get("goals") ?? "")
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!topic && files.length === 0) {
      return NextResponse.json({ error: "Add a topic or attach material." }, { status: 400 });
    }

    const studentId = currentStudentId(req);
    // Persist motivation/goals onto the profile so future modules can use them.
    updateStudentMeta({ motivation, goals: goals.length ? goals : undefined }, studentId);

    const { pageText } = await extractFiles(files);

    // Web-grounded research first (best-effort; never blocks) so the outline and
    // every module draw on real, varied examples instead of generic defaults.
    const research = await researchTopic({
      topic: topic || "the attached material",
      goals,
      motivation,
    });

    const outline = await generateOutline({
      topic: topic || "the attached material",
      goals,
      motivation,
      pageText,
      hint: learnerHint(studentId),
      research,
    });

    const course = createCourse({
      title: outline.title,
      topic: topic || outline.title,
      goals,
      mode,
      docContext: pageText || undefined,
      research,
      outline: outline.modules,
      studentId,
    });

    return NextResponse.json({ course });
  } catch (err) {
    console.error("outline error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Outline failed" },
      { status: 500 }
    );
  }
}
