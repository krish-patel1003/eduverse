"use client";

import { useEffect, useState } from "react";
import type { PlayerHandle } from "@/components/ExplainerPlayer";
import ModuleAssistant from "@/components/ModuleAssistant";
import NotesTab from "@/components/NotesTab";
import type { Explainer, LearningEvent, Quiz } from "@/lib/types";

type Tab = "notes" | "quiz" | "ask" | "assignment";

interface Props {
  courseId: string;
  moduleId: string;
  playerRef: React.RefObject<PlayerHandle | null>;
  /** Launch a sequential quiz that swaps in for the player. */
  onStartQuiz: (quizzes: Quiz[]) => void;
  onNewExplainer: (ex: Explainer) => void;
  /** Bumped by the parent when a quiz was just recorded, to refresh past attempts. */
  resultsKey: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "ask", label: "Ask AI" },
  { id: "quiz", label: "Quiz" },
  { id: "assignment", label: "Assignment" },
  { id: "notes", label: "Notes" },
];

export default function ModulePanel({ courseId, moduleId, playerRef, onStartQuiz, onNewExplainer, resultsKey }: Props) {
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <div className="module-panel">
      <div className="mp-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`mp-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mp-body">
        {tab === "ask" && <ModuleAssistant courseId={courseId} moduleId={moduleId} onNewExplainer={onNewExplainer} />}
        {tab === "quiz" && (
          <QuizTab courseId={courseId} moduleId={moduleId} onStartQuiz={onStartQuiz} resultsKey={resultsKey} />
        )}
        {tab === "assignment" && <AssignmentTab courseId={courseId} moduleId={moduleId} />}
        {tab === "notes" && <NotesTab courseId={courseId} moduleId={moduleId} playerRef={playerRef} />}
      </div>
    </div>
  );
}

// ---- Quiz launcher + past attempts ----------------------------------------

const dt = (ms: number) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function QuizTab({
  courseId,
  moduleId,
  onStartQuiz,
  resultsKey,
}: {
  courseId: string;
  moduleId: string;
  onStartQuiz: (q: Quiz[]) => void;
  resultsKey: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<LearningEvent[]>([]);

  useEffect(() => {
    let live = true;
    fetch(`/api/course/${courseId}/module/${moduleId}/results`)
      .then((r) => r.json())
      .then((d) => live && setPast(d.results ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [courseId, moduleId, resultsKey]);

  async function start() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/course/${courseId}/module/${moduleId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quiz" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Quiz failed");
      if (!data.quizzes?.length) throw new Error("No questions came back. Try again.");
      onStartQuiz(data.quizzes as Quiz[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="quiz-tab">
      <div className="qt-intro">
        <p>Test yourself on this module. Questions run one at a time and swap in for the video. You get a score, a breakdown, and a full review afterward.</p>
        <button className="send big" onClick={start} disabled={loading}>
          {loading ? "Building your quiz…" : "Start quiz ▸"}
        </button>
        {error && <div className="err small">{error}</div>}
      </div>
      {past.length > 0 && (
        <div className="qt-past">
          <h4>Past attempts</h4>
          {past.map((p) => {
            const d = (p.data ?? {}) as { total?: number; correct?: number };
            const total = d.total ?? 0;
            const correct = d.correct ?? 0;
            const pc = total ? Math.round((correct / total) * 100) : 0;
            return (
              <div key={p.id} className="qt-past-row">
                <span className={`qt-past-score ${pc === 100 ? "good" : pc >= 50 ? "mid" : "bad"}`}>{correct}/{total}</span>
                <span className="qt-past-pct">{pc}%</span>
                <span className="qt-past-time">{dt(p.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Assignment ------------------------------------------------------------

function AssignmentTab({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[] | null>(null);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/course/${courseId}/module/${moduleId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "assignment" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Assignment failed");
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assignment-tab">
      <div className="at-head">
        <p>Get a short take-home assignment to practice this module away from the video.</p>
        <button className="send big" onClick={generate} disabled={loading}>
          {loading ? "Writing tasks…" : tasks ? "New assignment ↻" : "Get assignment ▸"}
        </button>
        {error && <div className="err small">{error}</div>}
      </div>
      {tasks && (
        <ol className="at-tasks">
          {tasks.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
