import { NextRequest, NextResponse } from "next/server";
import { getModule } from "@/lib/store";
import { listQuizResults } from "@/lib/profile";

export const runtime = "nodejs";

// Past quiz attempts for a module, so results can be revisited later.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) return NextResponse.json({ error: "Module not found" }, { status: 404 });
    return NextResponse.json({ results: listQuizResults(mid) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
