import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId, ACTIVE_CHILD_COOKIE, childCookieOptions } from "@/lib/auth";
import { createChild, listChildren } from "@/lib/children";

export const runtime = "nodejs";

// The account's child profiles, plus which one is currently active.
export async function GET(req: NextRequest) {
  const userId = currentUserId(req);
  if (!userId) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ children: listChildren(userId), activeId: currentStudentId(req) });
}

// Add a child profile and switch to it immediately.
export async function POST(req: NextRequest) {
  try {
    const userId = currentUserId(req);
    if (!userId) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Give this learner a name." }, { status: 400 });
    if (listChildren(userId).length >= 10) {
      return NextResponse.json({ error: "You can have up to 10 learner profiles." }, { status: 400 });
    }

    const ageRaw = body?.age;
    const child = createChild(userId, {
      name,
      age: ageRaw === undefined || ageRaw === null || ageRaw === "" ? undefined : Math.max(3, Math.min(120, Math.round(Number(ageRaw)))),
      educationLevel: typeof body?.educationLevel === "string" ? body.educationLevel : undefined,
      avatar: typeof body?.avatar === "string" ? body.avatar : undefined,
    });

    const res = NextResponse.json({ child, children: listChildren(userId), activeId: child.id });
    res.cookies.set(ACTIVE_CHILD_COOKIE, child.id, childCookieOptions);
    return res;
  } catch (err) {
    console.error("create child error", err);
    return NextResponse.json({ error: "Could not add that learner." }, { status: 500 });
  }
}
