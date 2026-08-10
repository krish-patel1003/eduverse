import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule, saveModuleExplainer, setModuleRequirements } from "@/lib/store";
import { generateModuleExplainer, generateQuiz, generateAssignment } from "@/lib/course";
import { learnerHint, recordEvent } from "@/lib/profile";

export const runtime = "nodejs";
export const maxDuration = 300;

// Generate (and cache) the explainer for one module. A locked module refuses;
// an already-generated module returns its cached explainer. In certification
// mode, also generate + store the module's required quiz + assignment.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const course = getCourse(id);
    const mod = getModule(mid);
    if (!course || !mod || mod.courseId !== id) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    if (mod.status === "locked") {
      return NextResponse.json({ error: "Finish the previous module first." }, { status: 403 });
    }
    if (mod.explainer) {
      return NextResponse.json({ explainer: mod.explainer, cached: true });
    }

    const hint = learnerHint();
    const explainer = await generateModuleExplainer(course, mod, hint);
    saveModuleExplainer(mid, explainer);
    recordEvent({ type: "module_started", moduleId: mid, data: { title: mod.title } });

    // Certification mode: the required quiz + assignment are part of the content.
    if (course.mode === "certification") {
      const context = explainer.scenes.map((s) => s.narration).filter(Boolean).join(" ").slice(0, 8000);
      try {
        const [quiz, assignment] = await Promise.all([
          generateQuiz({ context, hint }),
          generateAssignment({ context, hint }),
        ]);
        setModuleRequirements(mid, quiz, assignment);
      } catch (e) {
        console.error("required content generation failed:", e);
      }
    }

    // Return the freshly-updated module so the client sees required content.
    return NextResponse.json({ explainer, module: getModule(mid) });
  } catch (err) {
    console.error("module generate error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
