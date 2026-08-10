import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateStudentMeta, updateLearningStyle } from "@/lib/profile";
import type { LearningStyle } from "@/lib/types";

export const runtime = "nodejs";

// The aggregated student profile for the dashboard.
export async function GET() {
  try {
    return NextResponse.json({ profile: getProfile() });
  } catch (err) {
    console.error("get profile error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

// Update motivation / goals / learning style from the dashboard.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const meta: { motivation?: string; goals?: string[] } = {};
    if (typeof body?.motivation === "string") meta.motivation = body.motivation.trim();
    if (Array.isArray(body?.goals))
      meta.goals = body.goals.filter((g: unknown) => typeof g === "string" && g.trim()).map((g: string) => g.trim());
    if (meta.motivation !== undefined || meta.goals !== undefined) updateStudentMeta(meta);

    if (body?.learningStyle && typeof body.learningStyle === "object") {
      updateLearningStyle(body.learningStyle as Partial<LearningStyle>);
    }

    return NextResponse.json({ profile: getProfile() });
  } catch (err) {
    console.error("update profile error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
