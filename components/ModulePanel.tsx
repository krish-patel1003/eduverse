"use client";

import { useEffect, useState } from "react";
import type { PlayerHandle } from "@/components/ExplainerPlayer";
import type { QuizKind } from "@/components/CourseQuiz";
import ModuleAssistant from "@/components/ModuleAssistant";
import NotesTab from "@/components/NotesTab";
import type { AssignmentGrade, CourseMode, CourseModule, Explainer, LearningEvent, Quiz } from "@/lib/types";

type Tab = "notes" | "quiz" | "ask" | "assignment";

interface Props {
  courseId: string;
  moduleId: string;
  mode: CourseMode;
  /** The current module, for certification pass-state + required content. */
  module: CourseModule;
  playerRef: React.RefObject<PlayerHandle | null>;
  /** Launch a sequential quiz that swaps in for the player. */
  onStartQuiz: (quizzes: Quiz[], kind: QuizKind) => void;
  onNewExplainer: (ex: Explainer) => void;
  /** Reload the course (after a requirement is met) so gating state refreshes. */
  onProgress: () => void;
  /** Bumped by the parent when a quiz was just recorded, to refresh past attempts. */
  resultsKey: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "ask", label: "Ask AI" },
  { id: "quiz", label: "Quiz" },
  { id: "assignment", label: "Assignment" },
  { id: "notes", label: "Notes" },
];

export default function ModulePanel({
  courseId,
  moduleId,
  mode,
  module: mod,
  playerRef,
  onStartQuiz,
  onNewExplainer,
  onProgress,
  resultsKey,
}: Props) {
  const [tab, setTab] = useState<Tab>("ask");
  const cert = mode === "certification";

  return (
    <div className="module-panel">
      <div className="mp-tabs">
        {TABS.map((t) => {
          const done = cert && ((t.id === "quiz" && mod.quizPassed) || (t.id === "assignment" && mod.assignmentPassed));
          return (
            <button key={t.id} className={`mp-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {done && <span className="mp-tab-check">✓</span>}
              {t.label}
              {cert && (t.id === "quiz" || t.id === "assignment") && <span className="mp-req-dot" title="Required" />}
            </button>
          );
        })}
      </div>
      <div className="mp-body">
        {tab === "ask" && <ModuleAssistant courseId={courseId} moduleId={moduleId} onNewExplainer={onNewExplainer} />}
        {tab === "quiz" &&
          (cert ? (
            <RequiredQuizTab module={mod} onStart={(qs) => onStartQuiz(qs, "required")} />
          ) : (
            <QuizTab courseId={courseId} moduleId={moduleId} onStartQuiz={(qs) => onStartQuiz(qs, "practice")} resultsKey={resultsKey} />
          ))}
        {tab === "assignment" &&
          (cert ? (
            <RequiredAssignmentTab courseId={courseId} moduleId={moduleId} module={mod} onProgress={onProgress} />
          ) : (
            <AssignmentTab courseId={courseId} moduleId={moduleId} />
          ))}
        {tab === "notes" && <NotesTab courseId={courseId} moduleId={moduleId} playerRef={playerRef} />}
      </div>
    </div>
  );
}

// ---- certification: required quiz ------------------------------------------

function RequiredQuizTab({ module: mod, onStart }: { module: CourseModule; onStart: (q: Quiz[]) => void }) {
  const quiz = mod.requiredQuiz ?? [];
  return (
    <div className="quiz-tab">
      <div className="qt-intro">
        {mod.quizPassed ? (
          <p className="req-passed">✓ You passed this module's required quiz. You can retake it any time.</p>
        ) : (
          <p>This module has a <b>required quiz</b>. Score 70% or more to satisfy the requirement. Questions run one at a time and swap in for the video.</p>
        )}
        <button className="send big" onClick={() => onStart(quiz)} disabled={quiz.length === 0}>
          {quiz.length === 0 ? "Preparing quiz…" : mod.quizPassed ? "Retake quiz ▸" : "Start required quiz ▸"}
        </button>
      </div>
    </div>
  );
}

// ---- certification: required, AI-graded assignment -------------------------

function RequiredAssignmentTab({
  courseId,
  moduleId,
  module: mod,
  onProgress,
}: {
  courseId: string;
  moduleId: string;
  module: CourseModule;
  onProgress: () => void;
}) {
  const tasks = mod.requiredAssignment ?? [];
  const [answers, setAnswers] = useState<string[]>(() => tasks.map((_, i) => mod.assignmentSubmission?.[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState<AssignmentGrade | null>(null);

  async function submit() {
    if (busy) return;
    if (answers.every((a) => !a.trim())) {
      setError("Write your answers before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/course/${courseId}/module/${moduleId}/submit-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Grading failed");
      setGrade(data.grade as AssignmentGrade);
      onProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setBusy(false);
    }
  }

  if (tasks.length === 0) return <p className="nt-empty">Preparing the assignment…</p>;

  return (
    <div className="assignment-tab">
      {mod.assignmentPassed && !grade && (
        <p className="req-passed">✓ You passed this module's assignment. You can revise and resubmit if you like.</p>
      )}
      <p className="at-head-note">Answer each task in your own words, then submit for grading. You need to pass to complete the module.</p>
      <ol className="ra-tasks">
        {tasks.map((t, i) => (
          <li key={i} className="ra-task">
            <div className="ra-task-text">{t}</div>
            <textarea
              value={answers[i]}
              onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="Your answer…"
              rows={3}
            />
            {grade?.perTask[i] && (
              <div className={`ra-feedback ${grade.perTask[i].ok ? "ok" : "bad"}`}>
                <b>{grade.perTask[i].ok ? "✓ " : "✗ "}</b>
                {grade.perTask[i].feedback}
              </div>
            )}
          </li>
        ))}
      </ol>
      {grade && (
        <div className={`ra-verdict ${grade.passed ? "pass" : "fail"}`}>
          <b>{grade.passed ? "Passed" : "Not passed yet"} · {grade.score}%</b>
          {grade.overall && <span>{grade.overall}</span>}
        </div>
      )}
      {error && <div className="err small">{error}</div>}
      <button className="send big" onClick={submit} disabled={busy}>
        {busy ? "Grading your answers…" : grade ? "Resubmit ↻" : "Submit for grading ▸"}
      </button>
    </div>
  );
}

// ---- self-eval: on-demand quiz launcher + past attempts --------------------

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
