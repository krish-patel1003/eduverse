import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { getPath } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  const path = getPath(id, currentStudentId(req));
  if (!path) return NextResponse.json({ error: "Path not found" }, { status: 404 });
  return NextResponse.json({ path });
}
