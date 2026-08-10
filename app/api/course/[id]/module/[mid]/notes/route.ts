import { NextRequest, NextResponse } from "next/server";
import { getModule, listNotes, addNote, deleteNote } from "@/lib/store";

export const runtime = "nodejs";

// Persisted, timestamped notes for a course module.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) return NextResponse.json({ error: "Module not found" }, { status: 404 });
    return NextResponse.json({ notes: listNotes(mid) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const { id, mid } = await ctx.params;
    const mod = getModule(mid);
    if (!mod || mod.courseId !== id) return NextResponse.json({ error: "Module not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });
    const tMs = Number(body?.tMs);
    const note = addNote({ courseId: id, moduleId: mid, tMs: Number.isFinite(tMs) ? tMs : 0, text: text.slice(0, 500) });
    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const noteId = String(body?.noteId ?? "");
    if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    deleteNote(noteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
