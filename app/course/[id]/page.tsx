"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import ExplainerPlayer, { type PlayerHandle } from "@/components/ExplainerPlayer";
import ModulePanel from "@/components/ModulePanel";
import CourseQuiz from "@/components/CourseQuiz";
import AppNav from "@/components/AppNav";
import type { Course, CourseModule, Explainer, Quiz } from "@/lib/types";

const statusIcon: Record<string, string> = {
  locked: "🔒",
  unlocked: "▶",
  in_progress: "◐",
  completed: "✓",
};

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Session cache of generated explainers, plus a transient re-explanation override.
  const [explainers, setExplainers] = useState<Record<string, Explainer>>({});
  const [override, setOverride] = useState<Explainer | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [reexBusy, setReexBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quizActive, setQuizActive] = useState<Quiz[] | null>(null);
  const [resultsKey, setResultsKey] = useState(0);
  const genRef = useRef<Set<string>>(new Set());
  const playerRef = useRef<PlayerHandle>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/course/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      const c: Course = data.course;
      setCourse(c);
      setExplainers((prev) => {
        const next = { ...prev };
        for (const m of c.modules) if (m.explainer) next[m.id] = m.explainer;
        return next;
      });
      setSelectedId((cur) => {
        if (cur && c.modules.some((m) => m.id === cur)) return cur;
        const active = c.modules.find((m) => m.status === "in_progress" || m.status === "unlocked");
        return (active ?? c.modules[0])?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = course?.modules.find((m) => m.id === selectedId) ?? null;
  const displayExplainer = override ?? (selectedId ? explainers[selectedId] : undefined);

  const generate = useCallback(
    async (mod: CourseModule) => {
      if (genRef.current.has(mod.id) || explainers[mod.id]) return;
      genRef.current.add(mod.id);
      setGenLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/course/${id}/module/${mod.id}/generate`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Generation failed");
        setExplainers((prev) => ({ ...prev, [mod.id]: data.explainer }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
        genRef.current.delete(mod.id);
      } finally {
        setGenLoading(false);
      }
    },
    [id, explainers]
  );

  useEffect(() => {
    setOverride(null);
    setQuizActive(null);
    if (selected && selected.status !== "locked" && !explainers[selected.id]) {
      generate(selected);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectModule(m: CourseModule) {
    if (m.status === "locked") return;
    setSelectedId(m.id);
  }

  async function approve() {
    setError(null);
    try {
      const res = await fetch(`/api/course/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Approve failed");
      setCourse(data.course);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function markComplete() {
    if (!selected || completing) return;
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/course/${id}/module/${selected.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Complete failed");
      const updated: Course = data.course;
      setCourse(updated);
      const next = updated.modules.find((m) => m.idx === selected.idx + 1);
      if (next && next.status !== "locked") setSelectedId(next.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setCompleting(false);
    }
  }

  // Re-explain a specific clip's narration (from the player's "Re-explain this
  // clip"), swapping the focused video in.
  const reExplainFocus = useCallback(
    async (focus: string) => {
      if (!selected || reexBusy) return;
      setReexBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/course/${id}/module/${selected.id}/interact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "explain", request: "", focus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Re-explain failed");
        if (data.explainer) setOverride(data.explainer as Explainer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Re-explain failed");
      } finally {
        setReexBusy(false);
      }
    },
    [id, selected, reexBusy]
  );

  if (notFound) {
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow"><div className="err">Course not found.</div></div>
      </div>
    );
  }
  if (!course) {
    return (
      <div className="shell">
        <AppNav />
        <div className="page narrow"><p className="muted">Loading course…</p></div>
      </div>
    );
  }

  const doneCount = course.modules.filter((m) => m.status === "completed").length;
  const pct = course.modules.length ? Math.round((doneCount / course.modules.length) * 100) : 0;
  const isDraft = course.status === "draft";
  const ready = !!selected && !!displayExplainer && !isDraft;

  return (
    <div className="shell">
      <AppNav />
      <div className="course-layout two">
        {/* ---- module list ---- */}
        <aside className="modules-rail">
          <div className="mr-head">
            <div className="mr-title">{course.title}</div>
            <div className="mr-progress">
              <div className="cc-bar"><span style={{ width: `${pct}%` }} /></div>
              <span className="mr-pct">{doneCount}/{course.modules.length}</span>
            </div>
          </div>
          <div className="module-list">
            {course.modules.map((m) => (
              <button
                key={m.id}
                className={`module-item ${m.status} ${m.id === selectedId ? "active" : ""}`}
                onClick={() => selectModule(m)}
                disabled={m.status === "locked"}
              >
                <span className="mi-icon">{statusIcon[m.status]}</span>
                <span className="mi-body">
                  <span className="mi-idx">Module {m.idx + 1}</span>
                  <span className="mi-title">{m.title}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ---- center: full-width player + tabbed panel ---- */}
        <main className="course-main">
          {isDraft && (
            <div className="draft-banner">
              This course outline is not approved yet.
              <button className="send" onClick={approve}>Approve &amp; start ▸</button>
            </div>
          )}

          {/* Responsive: video + panel side-by-side on wide screens (fills the
              side space); stacks with the panel below on narrow screens. When a
              quiz or re-explanation takes over, the panel is hidden and the
              stage spans full width. */}
          <div className={`module-grid ${!ready || quizActive ? "solo" : ""}`}>
            <div className="module-left">
          {selected && (
            <div className="module-head">
              <h1>{selected.title}</h1>
              {selected.summary && <p className="module-summary">{selected.summary}</p>}
            </div>
          )}

          <div className="player-wrap">
            {quizActive ? (
              <CourseQuiz
                quizzes={quizActive}
                courseId={course.id}
                moduleId={selected!.id}
                onExit={() => setQuizActive(null)}
                onRecorded={() => setResultsKey((k) => k + 1)}
              />
            ) : reexBusy ? (
              <div className="render-card standalone">
                <div className="render-title">✎ Re-explaining that part…</div>
                <div className="render-sub">Building a focused, fresh take on the clip you marked — about a minute.</div>
                <div className="render-bar"><span /></div>
              </div>
            ) : displayExplainer ? (
              <ExplainerPlayer ref={playerRef} explainer={displayExplainer} onReExplain={reExplainFocus} />
            ) : genLoading ? (
              <div className="render-card standalone">
                <div className="render-title">✎ Building this module…</div>
                <div className="render-sub">Writing the script, drawing the scenes, recording narration — about a minute.</div>
                <div className="render-bar"><span /></div>
              </div>
            ) : selected?.status === "locked" ? (
              <div className="locked-note">🔒 Finish the previous module to unlock this one.</div>
            ) : (
              <div className="locked-note">Select a module to begin.</div>
            )}
          </div>

          {ready && !quizActive && (
            <div className="module-foot">
              {override && (
                <button className="ghost-btn" onClick={() => setOverride(null)}>◂ Back to the module video</button>
              )}
              {selected!.status !== "completed" ? (
                <button className="send big" onClick={markComplete} disabled={completing}>
                  {completing ? "Saving…" : "Mark module complete ▸"}
                </button>
              ) : (
                <span className="done-chip">✓ Completed</span>
              )}
            </div>
          )}
          {error && <div className="err">{error}</div>}
            </div>

            {ready && !quizActive && (
              <div className="module-right">
                <ModulePanel
                  key={selected!.id}
                  courseId={course.id}
                  moduleId={selected!.id}
                  playerRef={playerRef}
                  onStartQuiz={(qs) => setQuizActive(qs)}
                  onNewExplainer={(ex) => setOverride(ex)}
                  resultsKey={resultsKey}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
