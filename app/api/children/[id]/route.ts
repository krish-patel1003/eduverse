import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId, ACTIVE_CHILD_COOKIE, childCookieOptions } from "@/lib/auth";
import { deleteChild, defaultChildId, listChildren } from "@/lib/children";

export const runtime = "nodejs";

// Remove a learner profile and all of its learning data. The account's last
// profile cannot be removed, since there must always be an active learner.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { id } = await ctx.params;
  const wasActive = currentStudentId(req) === id;
  const result = deleteChild(id, userId);

  if (!result.ok) {
    if (result.reason === "last_child") {
      return NextResponse.json({ error: "You need at least one learner profile." }, { status: 400 });
    }
    return NextResponse.json({ error: "That learner was not found." }, { status: 404 });
  }

  const children = listChildren(userId);
  const activeId = wasActive ? defaultChildId(userId) : currentStudentId(req);
  const res = NextResponse.json({ ok: true, children, activeId });
  // Deleting the active learner falls back to the first remaining profile.
  if (wasActive) res.cookies.set(ACTIVE_CHILD_COOKIE, activeId, childCookieOptions);
  return res;
}
