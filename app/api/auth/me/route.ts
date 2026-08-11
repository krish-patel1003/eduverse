import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";

export const runtime = "nodejs";

// Who is logged in (+ their profile), or { user: null } when anonymous.
export async function GET(req: NextRequest) {
  const user = currentUser(req);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user, profile: getProfile(user.id) });
}
