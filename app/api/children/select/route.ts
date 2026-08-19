import { NextRequest, NextResponse } from "next/server";
import { currentUserId, ACTIVE_CHILD_COOKIE, childCookieOptions } from "@/lib/auth";
import { childBelongsTo, getChild } from "@/lib/children";

export const runtime = "nodejs";

// Switch the active child profile. Ownership is verified before the cookie is
// set, so a user can never select a learner belonging to another account.
export async function POST(req: NextRequest) {
  const userId = currentUserId(req);
  if (!userId) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !childBelongsTo(id, userId)) {
    return NextResponse.json({ error: "That learner was not found." }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, activeId: id, child: getChild(id) });
  res.cookies.set(ACTIVE_CHILD_COOKIE, id, childCookieOptions);
  return res;
}
