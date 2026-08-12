import { NextRequest, NextResponse } from "next/server";
import { listCourses } from "@/lib/store";
import { currentStudentId } from "@/lib/auth";

export const runtime = "nodejs";

// All courses for the logged-in student, newest first.
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ courses: listCourses(currentStudentId(req)) });
  } catch (err) {
    console.error("list courses error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list courses" },
      { status: 500 }
    );
  }
}
