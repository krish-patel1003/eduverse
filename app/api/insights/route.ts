import { NextRequest, NextResponse } from "next/server";
import { currentUserId, currentStudentId } from "@/lib/auth";
import { effectivenessOverview } from "@/lib/effectiveness";
import { getChild, getHiFi } from "@/lib/children";
import { listWeakAreas } from "@/lib/adaptive";
import { ladderGraphStats } from "@/lib/diagnose";
import { METHOD_LABEL, MODE_EMOJI, MODE_LABEL } from "@/lib/pedagogy";

export const runtime = "nodejs";

// The grown-up view. Unlike every child-facing surface, this one DOES name the
// instructional methods (Kumon, Singapore, ...) because a parent or teacher
// benefits from knowing which tradition is actually working for this learner.
export async function GET(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const studentId = currentStudentId(req);

  const skills = effectivenessOverview(studentId).map((s) => ({
    skill: s.skill,
    topic: s.topic,
    stats: s.stats.map((st) => ({
      ...st,
      modeLabel: MODE_LABEL[st.mode] ?? st.mode,
      modeEmoji: MODE_EMOJI[st.mode] ?? "",
      methodLabel: METHOD_LABEL[st.method] ?? st.method,
    })),
  }));

  const areas = listWeakAreas(studentId);
  return NextResponse.json({
    child: getChild(studentId),
    hifi: getHiFi(studentId),
    skills,
    summary: {
      tracked: areas.length,
      mastered: areas.filter((a) => a.status === "mastered").length,
      learning: areas.filter((a) => a.status === "learning").length,
      weak: areas.filter((a) => a.status === "weak").length,
      graph: ladderGraphStats(),
    },
  });
}

// Toggle the high-fidelity lesson preference for the active child.
export async function POST(req: NextRequest) {
  if (!currentUserId(req)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const studentId = currentStudentId(req);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.hifi === "boolean") {
    const { setHiFi } = await import("@/lib/children");
    setHiFi(studentId, body.hifi);
  }
  return NextResponse.json({ ok: true, hifi: getHiFi(studentId) });
}
