"use client";

import { useMemo, useState } from "react";
import type { Quiz } from "@/lib/types";

interface Props {
  quizzes: Quiz[];
  courseId: string;
  moduleId: string;
  /** Return to the module video. */
  onExit: () => void;
  /** Called after results are recorded, so the launcher can refresh past attempts. */
  onRecorded?: () => void;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// Sequential quiz that takes over the player area: one question at a time, then
// a results screen with per-concept analysis and a full review (every option
// annotated with why it is right or wrong).
export default function CourseQuiz({ quizzes, courseId, moduleId, onExit, onRecorded }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<"quiz" | "results">("quiz");
  const [recorded, setRecorded] = useState(false);

  const q = quizzes[idx];
  const chosen = answers[q?.id] ?? [];
  const isLast = idx === quizzes.length - 1;

  const graded = useMemo(
    () =>
      quizzes.map((quiz) => ({
        quiz,
        picked: answers[quiz.id] ?? [],
        correct: sameSet(answers[quiz.id] ?? [], quiz.correct),
      })),
    [quizzes, answers]
  );
  const score = graded.filter((g) => g.correct).length;

  // Per-concept breakdown for the basic analysis.
  const byConcept = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const g of graded) {
      const key = g.quiz.concept || "general";
      const e = m.get(key) ?? { correct: 0, total: 0 };
      e.total += 1;
      if (g.correct) e.correct += 1;
      m.set(key, e);
    }
    return [...m.entries()];
  }, [graded]);

  function toggle(oid: string) {
    if (!q) return;
    setAnswers((s) => {
      const cur = s[q.id] ?? [];
      if (q.multi) return { ...s, [q.id]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
      return { ...s, [q.id]: [oid] };
    });
  }

  async function finish() {
    setPhase("results");
    if (recorded) return;
    setRecorded(true);
    const items = graded.map((g) => ({ concept: g.quiz.concept, isCorrect: g.correct }));
    try {
      await fetch(`/api/course/${courseId}/module/${moduleId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quiz-result", items }),
      });
      onRecorded?.();
    } catch {
      /* best-effort */
    }
  }

  // ---- results + review ----
  if (phase === "results") {
    return (
      <div className="cq results">
        <div className="cq-results-head">
          <div className="cq-score-ring" data-pct={Math.round((score / quizzes.length) * 100)}>
            <span className="cq-score-num">{score}/{quizzes.length}</span>
            <span className="cq-score-lbl">{Math.round((score / quizzes.length) * 100)}%</span>
          </div>
          <div className="cq-analysis">
            <h3>How you did</h3>
            <div className="cq-concepts">
              {byConcept.map(([name, e]) => {
                const pc = Math.round((e.correct / e.total) * 100);
                const cls = pc === 100 ? "good" : pc >= 50 ? "mid" : "bad";
                return (
                  <div key={name} className="cq-concept-row">
                    <span className="cq-concept-name">{name}</span>
                    <span className="cq-concept-bar"><span className={cls} style={{ width: `${pc}%` }} /></span>
                    <span className="cq-concept-num">{e.correct}/{e.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <h3 className="cq-review-h">Review</h3>
        <div className="cq-review">
          {graded.map((g, i) => (
            <div key={g.quiz.id} className={`cq-rev-q ${g.correct ? "ok" : "bad"}`}>
              <div className="cq-rev-question">
                <span className="cq-rev-verdict">{g.correct ? "✓" : "✗"}</span>
                <b>{i + 1}.</b> {g.quiz.question}
              </div>
              <div className="cq-rev-options">
                {g.quiz.options.map((o) => {
                  const isCorrect = g.quiz.correct.includes(o.id);
                  const wasPicked = g.picked.includes(o.id);
                  let cls = "cq-rev-opt";
                  if (isCorrect) cls += " correct";
                  if (wasPicked && !isCorrect) cls += " wrong";
                  return (
                    <div key={o.id} className={cls}>
                      <span className="cq-rev-mark">
                        {isCorrect ? "✓" : wasPicked ? "✗" : "•"}
                      </span>
                      <span className="cq-rev-text">
                        <span className="cq-rev-opt-label">
                          {o.text}
                          {wasPicked && <span className="cq-your"> (your pick)</span>}
                        </span>
                        {o.reason && <span className="cq-rev-reason">{o.reason}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {g.quiz.explanation && <div className="cq-rev-explain">{g.quiz.explanation}</div>}
            </div>
          ))}
        </div>

        <div className="cq-foot">
          <button className="send big" onClick={onExit}>Back to the video ▸</button>
        </div>
      </div>
    );
  }

  // ---- sequential questions ----
  if (!q) return null;
  return (
    <div className="cq">
      <div className="cq-top">
        <span className="cq-progress">Question {idx + 1} of {quizzes.length}</span>
        <span className="cq-kind">{q.multi ? "Select all that apply" : "Choose one"}</span>
        <button className="cq-quit" onClick={onExit} title="Leave quiz">✕</button>
      </div>
      <div className="cq-bar"><span style={{ width: `${((idx) / quizzes.length) * 100}%` }} /></div>

      <div className="cq-question">{q.question}</div>
      <div className="cq-options">
        {q.options.map((o) => (
          <button
            key={o.id}
            className={`cq-opt ${chosen.includes(o.id) ? "picked" : ""}`}
            onClick={() => toggle(o.id)}
          >
            <span className="cq-opt-mark">{chosen.includes(o.id) ? "●" : "○"}</span>
            {o.text}
          </button>
        ))}
      </div>

      <div className="cq-foot">
        {idx > 0 && (
          <button className="ghost-btn" onClick={() => setIdx((i) => i - 1)}>◂ Back</button>
        )}
        <div className="spacer" />
        <button
          className="send big"
          disabled={chosen.length === 0}
          onClick={() => (isLast ? finish() : setIdx((i) => i + 1))}
        >
          {isLast ? "Finish & see results ▸" : "Next ▸"}
        </button>
      </div>
    </div>
  );
}
