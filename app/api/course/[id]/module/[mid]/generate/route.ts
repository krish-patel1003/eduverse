import { NextRequest, NextResponse } from "next/server";
import { getCourse, getModule, saveModuleExplainer } from "@/lib/store";
import { generateModuleExplainer } from "@/lib/course";
import { learnerHint, recordEvent } from "@/lib/profile";

export const runtime = "nodejs";
export const maxDuration = 300;

// Generate (and cache) the explainer for one module. A locked module refuses;
// an already-generated module returns its cached explainer.
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

    const explainer = await generateModuleExplainer(course, mod, learnerHint());
    saveModuleExplainer(mid, explainer);
    recordEvent({ type: "module_started", moduleId: mid, data: { title: mod.title } });

    return NextResponse.json({ explainer });
  } catch (err) {
    console.error("module generate error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
