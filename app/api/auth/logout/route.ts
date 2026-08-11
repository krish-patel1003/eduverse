import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) destroySession(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
}
