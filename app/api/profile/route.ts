import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateStudentMeta, updateLearningStyle } from "@/lib/profile";
import { currentStudentId } from "@/lib/auth";
import type { LearningStyle } from "@/lib/types";

export const runtime = "nodejs";

// The aggregated student profile for the dashboard.
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ profile: getProfile(currentStudentId(req)) });
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
    const studentId = currentStudentId(req);
    const body = await req.json().catch(() => ({}));
    const meta: { name?: string; age?: number; gender?: string; educationLevel?: string; motivation?: string; goals?: string[] } = {};
    if (typeof body?.name === "string") meta.name = body.name.trim().slice(0, 80);
    if (body?.age !== undefined && body.age !== null && body.age !== "") meta.age = Math.max(3, Math.min(120, Math.round(Number(body.age))));
    if (typeof body?.gender === "string") meta.gender = body.gender.trim().slice(0, 40);
    if (typeof body?.educationLevel === "string") meta.educationLevel = body.educationLevel.trim().slice(0, 60);
    if (typeof body?.motivation === "string") meta.motivation = body.motivation.trim();
    if (Array.isArray(body?.goals))
      meta.goals = body.goals.filter((g: unknown) => typeof g === "string" && g.trim()).map((g: string) => g.trim());
    if (Object.keys(meta).length) updateStudentMeta(meta, studentId);

    if (body?.learningStyle && typeof body.learningStyle === "object") {
      updateLearningStyle(body.learningStyle as Partial<LearningStyle>, studentId);
    }

    return NextResponse.json({ profile: getProfile(studentId) });
  } catch (err) {
    console.error("update profile error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
