import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getDiagnosticForReview } from "@/lib/adaptive";

export const runtime = "nodejs";

// Look back over a graded diagnostic: every question, what the learner answered,
// what was correct, and why. Scoped to the active child, so one learner's review
// can never be fetched for another.
export async function GET(req: NextRequest, ctx: { params: Promise<{ did: string }> }) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { did } = await ctx.params;
  const d = getDiagnosticForReview(did, currentStudentId(req));
  if (!d) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json(d);
}
