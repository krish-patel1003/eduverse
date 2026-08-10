import { NextRequest, NextResponse } from "next/server";
import { getCourse } from "@/lib/store";

export const runtime = "nodejs";

// Full course with its modules + unlock state.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const course = getCourse(id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json({ course });
  } catch (err) {
    console.error("get course error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load course" },
      { status: 500 }
    );
  }
}
