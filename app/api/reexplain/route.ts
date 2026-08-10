import { NextRequest, NextResponse } from "next/server";
import { reExplainRange } from "@/lib/gemini";
import type { Style } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const originalTitle = String(body?.originalTitle ?? "this topic");
    const style: Style = body?.style === "interactive" ? "interactive" : "linear";
    const focusNarration = String(body?.focusNarration ?? "").trim();
    const userNote = body?.userNote ? String(body.userNote) : undefined;

    if (!focusNarration) {
      return NextResponse.json({ error: "Nothing selected to re-explain." }, { status: 400 });
    }

    const explainer = await reExplainRange({ originalTitle, style, focusNarration, userNote });
    return NextResponse.json({ explainer });
  } catch (err) {
    console.error("reexplain error", err);
    const message = err instanceof Error ? err.message : "Re-explain failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
