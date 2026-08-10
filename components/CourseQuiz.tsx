"use client";

import { useMemo, useState } from "react";
import type { Certificate, Quiz } from "@/lib/types";

/** practice = ungraded self-check; required = module gate; exam = final certification exam. */
export type QuizKind = "practice" | "required" | "exam";

interface Props {
  quizzes: Quiz[];
  courseId: string;
  moduleId?: string;
  kind?: QuizKind;
  /** Learner name sent with an exam submission (for the certificate). */
  learnerName?: string;
  /** Return to the module video. */
  onExit: () => void;
  /** Called after results are recorded, so the launcher can refresh past attempts. */
  onRecorded?: () => void;
  /** Graded outcome (required/exam): whether it passed, and any issued certificate. */
  onOutcome?: (o: { passed: boolean; score: number; certificate?: Certificate }) => void;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

const PASS_PCT = 70;

// Sequential quiz that takes over the player area: one question at a time, then
// a results screen with per-concept analysis and a full review (every option
// annotated with why it is right or wrong). Used for practice self-checks, the
// required per-module gate, and the final certification exam.
export default function CourseQuiz({
  quizzes,
  courseId,
  moduleId,
  kind = "practice",
  learnerName,
  onExit,
  onRecorded,
  onOutcome,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<"quiz" | "results">("quiz");
  const [recorded, setRecorded] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

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

  const pct = Math.round((score / quizzes.length) * 100);
  const passed = pct >= PASS_PCT;

  async function finish() {
    setPhase("results");
    if (recorded) return;
    setRecorded(true);
    const items = graded.map((g) => ({ concept: g.quiz.concept, isCorrect: g.correct }));
    try {
      // Route the submission by kind: practice records to the profile; required
      // grades the module gate; exam grades and may issue a certificate.
      const url =
        kind === "required"
          ? `/api/course/${courseId}/module/${moduleId}/submit-quiz`
          : kind === "exam"
            ? `/api/course/${courseId}/exam`
            : `/api/course/${courseId}/module/${moduleId}/interact`;
      const body =
        kind === "exam"
          ? { items, name: learnerName }
          : kind === "required"
            ? { items }
            : { type: "quiz-result", items };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.certificate) setCertificate(data.certificate as Certificate);
      onRecorded?.();
      if (kind !== "practice") {
        onOutcome?.({ passed: data?.passed ?? passed, score: data?.score ?? pct, certificate: data?.certificate });
      }
    } catch {
      /* best-effort */
    }
  }

  // ---- results + review ----
  if (phase === "results") {
    return (
      <div className="cq results">
        {kind !== "practice" && (
          <div className={`cq-verdict-banner ${passed ? "pass" : "fail"}`}>
            <span className="cq-verdict-icon">{passed ? "✓" : "✗"}</span>
            <div className="cq-verdict-text">
              <b>
                {passed
                  ? kind === "exam"
                    ? "You passed the certification exam!"
                    : "Passed — this requirement is complete."
                  : `Not passed yet — you need ${PASS_PCT}% or more.`}
              </b>
              <span>
                {passed
                  ? kind === "exam"
                    ? "Your certificate has been issued."
                    : "You can move on when you're ready."
                  : "Review the answers below and try again."}
              </span>
            </div>
            {kind === "exam" && passed && certificate && (
              <a className="send big cq-cert-link" href={`/cert/${certificate.id}`}>
                View your certificate ▸
              </a>
            )}
          </div>
        )}
        <div className="cq-results-head">
          <div className="cq-score-ring" data-pct={pct}>
            <span className="cq-score-num">{score}/{quizzes.length}</span>
            <span className="cq-score-lbl">{pct}%</span>
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
          <button className="send big" onClick={onExit}>
            {kind === "exam" ? "Done" : passed ? "Back to the video ▸" : "Back and try again ▸"}
          </button>
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
