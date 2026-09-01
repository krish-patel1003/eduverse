import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { openStep } from "@/lib/paths";

export const runtime = "nodejs";

// Open one step. Creates the weak area the tutor teaches against, and refuses
// while the step is still locked, so the sequence cannot be skipped.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const stepId = String(body?.stepId ?? "");
  const weakAreaId = openStep(id, stepId, currentStudentId(req));
  if (!weakAreaId) {
    return NextResponse.json({ error: "Finish the step before this one first." }, { status: 409 });
  }
  return NextResponse.json({ weakAreaId });
}
