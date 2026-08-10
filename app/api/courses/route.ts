import { NextResponse } from "next/server";
import { listCourses } from "@/lib/store";

export const runtime = "nodejs";

// All courses for the current (implicit) student, newest first.
export async function GET() {
  try {
    return NextResponse.json({ courses: listCourses() });
  } catch (err) {
    console.error("list courses error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list courses" },
      { status: 500 }
    );
  }
}
