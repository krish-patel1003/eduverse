import { NextRequest, NextResponse } from "next/server";
import { approveCourse } from "@/lib/store";

export const runtime = "nodejs";

// Approve the draft outline: activate the course and unlock module 1.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const course = approveCourse(id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json({ course });
  } catch (err) {
    console.error("approve course error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 }
    );
  }
}
